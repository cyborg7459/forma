import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { resolve } from 'node:path';
import { apiRoutes } from './routes';
import { WorkspaceService } from './services/workspaceService';
import { HttpError } from './errors';
import type { Repository } from './repositories/repository';
import { projectRoot } from './paths';

const firstHeader = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();

export function createApp(repository: Repository, production = false) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (origin) {
      let parsed: URL;
      try { parsed = new URL(origin); } catch { return next(new HttpError(403, 'Invalid request origin')); }
      const host = firstHeader(request.headers['x-forwarded-host']) ?? request.headers.host;
      if (!host) return next(new HttpError(400, 'Request host is required'));
      const protocol = firstHeader(request.headers['x-forwarded-proto']) ?? request.protocol;
      const configured = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
      const allowed = new Set([
        `${protocol}://${host}`,
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        ...configured,
      ]);
      if (!allowed.has(parsed.origin)) return next(new HttpError(403, 'Request origin is not allowed'));
    }
    if (!['GET', 'HEAD'].includes(request.method)
      && request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json')
      return next(new HttpError(415, 'Send Content-Type: application/json'));
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', apiRoutes(new WorkspaceService(repository)));
  app.use('/api', (_request, _response, next) => next(new HttpError(404, 'API endpoint not found')));
  if (production) {
    const directory = resolve(projectRoot, 'dist');
    app.use(express.static(directory));
    app.get('/{*path}', (_request, response) => response.sendFile(resolve(directory, 'index.html')));
  }
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { message: error.issues.map(issue =>
        `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; '), details: error.issues } });
      return;
    }
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: { message: error.message } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: { message: 'Request body must be valid JSON' } });
      return;
    }
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
      response.status(413).json({ error: { message: 'Request body is too large' } });
      return;
    }
    console.error('API request failed', error);
    response.status(500).json({ error: { message: 'Unable to save or load your data. Check the server logs and try again.' } });
  };
  app.use(errors);
  return app;
}
