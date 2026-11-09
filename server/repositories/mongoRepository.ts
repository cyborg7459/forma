import { MongoClient, type Collection } from 'mongodb';
import { z } from 'zod';
import { databaseSchema, emptyDatabase, type Database } from '../../shared/models.js';
import type { Repository } from './repository.js';

interface WorkspaceDocument {
  _id: string;
  revision: number;
  data: Database;
}

const storedWorkspaceSchema = z.object({
  _id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  data: databaseSchema,
}).strict();

interface MongoRepositoryOptions {
  uri: string;
  database: string;
  workspaceId?: string;
}

export class MongoRepository implements Repository {
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private closePromise: Promise<void> | null = null;

  private constructor(
    private client: MongoClient,
    private collection: Collection<WorkspaceDocument>,
    private workspaceId: string,
  ) {}

  static async create({ uri, database, workspaceId = 'default' }: MongoRepositoryOptions): Promise<MongoRepository> {
    if (!uri.trim()) throw new Error('MONGODB_URI is required');
    if (!database.trim()) throw new Error('MONGODB_DB is required');
    if (!workspaceId.trim()) throw new Error('MONGODB_WORKSPACE_ID cannot be empty');

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
    });
    try {
      await client.connect();
      const db = client.db(database);
      await db.command({ ping: 1 });
      const collection = db.collection<WorkspaceDocument>('workspaces');
      await collection.updateOne(
        { _id: workspaceId },
        { $setOnInsert: { _id: workspaceId, revision: 0, data: emptyDatabase() } },
        { upsert: true },
      );
      const repository = new MongoRepository(client, collection, workspaceId);
      await repository.read();
      return repository;
    } catch (error) {
      await client.close().catch(closeError => {
        console.error('Failed to close MongoDB after startup error', closeError);
      });
      throw error;
    }
  }

  private async document(): Promise<WorkspaceDocument> {
    const document = await this.collection.findOne({ _id: this.workspaceId });
    if (!document) throw new Error(`MongoDB workspace "${this.workspaceId}" does not exist`);
    return storedWorkspaceSchema.parse(document);
  }

  async read(): Promise<Database> {
    if (this.closed) throw new Error('Database is closed');
    await this.queue;
    return structuredClone((await this.document()).data);
  }

  async update<T>(change: (db: Database) => T): Promise<T> {
    if (this.closed) throw new Error('Database is closed');
    const transaction = this.queue.then(async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const current = await this.document();
        const next = structuredClone(current.data);
        const result = change(next);
        const validated = databaseSchema.parse(next);
        const saved = await this.collection.replaceOne(
          { _id: this.workspaceId, revision: current.revision },
          { revision: current.revision + 1, data: validated },
        );
        if (saved.matchedCount === 1) return structuredClone(result);
      }
      throw new Error('Database changed repeatedly while saving. Retry the request.');
    });
    this.queue = transaction.catch(() => undefined);
    return transaction;
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.closePromise = this.queue.then(() => this.client.close());
    return this.closePromise;
  }
}
