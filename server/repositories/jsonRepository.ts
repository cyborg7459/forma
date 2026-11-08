import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import { databaseSchema, emptyDatabase, type Database } from '../../shared/models';
import { migrateDatabase } from './migrations';
import type { Repository } from './repository';

const lockOwnerSchema = z.object({
  pid: z.number().int().positive(),
  startedAt: z.string().datetime(),
});

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    if (code === 'EPERM') return true;
    throw error;
  }
}

export class JsonRepository implements Repository {
  private state: Database = emptyDatabase();
  private queue: Promise<unknown> = Promise.resolve();
  private lockPath: string;
  private closed = false;
  private releaseLease: (() => Promise<void>) | null = null;
  private ownsMarker = false;
  private closePromise: Promise<void> | null = null;

  private constructor(private filePath: string) { this.lockPath = `${filePath}.lock`; }

  static async create(filePath: string): Promise<JsonRepository> {
    const repository = new JsonRepository(filePath);
    await mkdir(dirname(filePath), { recursive: true });
    repository.releaseLease = await lockfile.lock(filePath, {
      realpath: false,
      lockfilePath: `${filePath}.lease`,
      stale: 5000,
      update: 1000,
      retries: { retries: 20, factor: 1, minTimeout: 500, maxTimeout: 500 },
    }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ELOCKED') throw new Error(
        `Database is locked by another running Forma server: ${filePath}. Stop that server before starting another one.`);
      throw error;
    });
    try {
      await repository.acquireOwnerMarker();
      let contents: string;
      try {
        contents = await readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await repository.persist(repository.state);
        return repository;
      }
      // A corrupt database must never be silently replaced with empty data.
      const stored: unknown = JSON.parse(contents);
      const state = migrateDatabase(stored);
      if (typeof stored === 'object' && stored !== null && 'version' in stored && stored.version === 1)
        await repository.persist(state);
      repository.state = state;
      return repository;
    } catch (error) {
      await repository.releaseDatabaseLock();
      throw error;
    }
  }

  private async writeOwnerMarker(): Promise<void> {
    const marker = await open(this.lockPath, 'wx', 0o600);
    this.ownsMarker = true;
    try {
      await marker.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    } finally {
      await marker.close();
    }
  }

  private async acquireOwnerMarker(): Promise<void> {
    try {
      await this.writeOwnerMarker();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const owner = lockOwnerSchema.safeParse(JSON.parse(await readFile(this.lockPath, 'utf8')));
    if (!owner.success) throw new Error(
      `Database lock metadata is invalid: ${this.lockPath}. Check the file before removing it; automatic recovery is unsafe.`);
    if (processIsRunning(owner.data.pid)) throw new Error(
      `Database is locked by process ${owner.data.pid}: ${this.filePath}. Stop that Forma server before restarting.`);
    // The lease serializes recovery, so two restarting servers cannot remove each other's marker.
    await unlink(this.lockPath);
    console.warn(`Recovered database lock from stopped process ${owner.data.pid}. Your data is unchanged.`);
    await this.writeOwnerMarker();
  }

  private async releaseDatabaseLock(): Promise<void> {
    try {
      if (this.ownsMarker) {
        await unlink(this.lockPath);
        this.ownsMarker = false;
      }
    } finally {
      if (this.releaseLease) {
        const release = this.releaseLease;
        this.releaseLease = null;
        await release();
      }
    }
  }

  async read(): Promise<Database> {
    await this.queue;
    return structuredClone(this.state);
  }

  async update<T>(change: (db: Database) => T): Promise<T> {
    if (this.closed) throw new Error('Database is closed');
    const transaction = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = change(next);
      databaseSchema.parse(next);
      await this.persist(next);
      this.state = next;
      return structuredClone(result);
    });
    // Keep the queue usable after a rejected transaction; callers still receive that rejection.
    this.queue = transaction.catch(() => undefined);
    return transaction;
  }

  private async persist(db: Database): Promise<void> {
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    const file = await open(temporaryPath, 'wx', 0o600);
    try {
      await file.writeFile(`${JSON.stringify(db, null, 2)}\n`, 'utf8');
      await file.sync();
      await file.close();
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await file.close();
      await unlink(temporaryPath).catch((cleanupError: NodeJS.ErrnoException) => {
        if (cleanupError.code !== 'ENOENT') console.error('Failed to clean temporary database file', cleanupError);
      });
      throw error;
    }
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.closePromise = this.queue.then(() => this.releaseDatabaseLock());
    return this.closePromise;
  }
}
