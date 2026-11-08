import { createApp } from '../server/app';
import { MongoRepository } from '../server/repositories/mongoRepository';

const repository = await MongoRepository.create({
  uri: process.env.MONGODB_URI ?? '',
  database: process.env.MONGODB_DB ?? 'forma',
  workspaceId: process.env.MONGODB_WORKSPACE_ID ?? 'default',
});

export default createApp(repository);
