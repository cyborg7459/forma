import type { Request, Response } from 'express';
import { createApp } from '../server/app';
import { MongoRepository } from '../server/repositories/mongoRepository';

type App = ReturnType<typeof createApp>;

let appPromise: Promise<App> | undefined;

function initializationMessage(error: unknown) {
  if (!(error instanceof Error)) return 'The API could not start.';
  if (error.message === 'MONGODB_URI is required') {
    return 'MONGODB_URI is missing. Add it to the Vercel Production environment and redeploy.';
  }
  if (error.name === 'MongoParseError') {
    return 'MONGODB_URI is invalid. Check the Vercel environment variable and redeploy.';
  }
  if (error.name === 'MongoServerSelectionError') {
    return 'MongoDB could not be reached. Check the Atlas cluster status and Network Access settings.';
  }
  if (error.name === 'MongoServerError' && /auth/i.test(error.message)) {
    return 'MongoDB rejected the configured credentials. Check the Atlas database user and MONGODB_URI.';
  }
  return 'The API could not connect to MongoDB.';
}

function getApp() {
  if (!appPromise) {
    appPromise = MongoRepository.create({
      uri: process.env.MONGODB_URI ?? '',
      database: process.env.MONGODB_DB ?? 'forma',
      workspaceId: process.env.MONGODB_WORKSPACE_ID ?? 'default',
    })
      .then(repository => createApp(repository))
      .catch(error => {
        appPromise = undefined;
        throw error;
      });
  }
  return appPromise;
}

export default async function handler(request: Request, response: Response) {
  try {
    const app = await getApp();
    app(request, response);
  } catch (error) {
    console.error('API initialization failed', error);
    if (!response.headersSent) {
      response.status(503).json({
        error: {
          code: 'DATABASE_INITIALIZATION_FAILED',
          message: initializationMessage(error),
        },
      });
    }
  }
}
