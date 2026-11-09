import type { Database } from '../../shared/models.js';

export interface Repository {
  read(): Promise<Database>;
  update<T>(change: (db: Database) => T): Promise<T>;
  close(): Promise<void>;
}
