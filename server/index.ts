import 'dotenv/config';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { createApp } from './app';
import { JsonRepository } from './repositories/jsonRepository';
import { MongoRepository } from './repositories/mongoRepository';
import type { Repository } from './repositories/repository';
import { projectRoot } from './paths';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
const production = process.argv.includes('--production');
if (production) await access(resolve(projectRoot, 'dist', 'index.html'));

async function openRepository(): Promise<Repository> {
  if (process.env.DATA_FILE) return JsonRepository.create(resolve(projectRoot, process.env.DATA_FILE));
  return MongoRepository.create({
    uri: process.env.MONGODB_URI ?? '',
    database: process.env.MONGODB_DB ?? 'forma',
    workspaceId: process.env.MONGODB_WORKSPACE_ID ?? 'default',
  });
}

const repository = await openRepository().catch(error => {
  console.error('Unable to open the Forma database:', error instanceof Error ? error.message : error);
  process.exit(1);
});
const host = process.env.HOST ?? '127.0.0.1';
const server = createApp(repository, production).listen(port, host, () => {
  console.log(`Forma API${production ? ' + web' : ''}: http://${host}:${port}`);
});
server.on('error', async error => {
  console.error('Server failed to start', error);
  await repository.close();
  process.exitCode = 1;
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
