import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { loadCustomer } from './middleware/loadCustomer.js';
import { syncEventsRouter } from './routes/syncEvents.js';
import { workspaceRouter } from './routes/workspace.js';
import { fastnTokenRouter, ordersRouter, healthRouter } from './routes/misc.js';

function originOf(url) {
  try { return new URL(url).origin; } catch { return null; }
}

export function createApp({ db, config, fetchImpl }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind ngrok / a hosting proxy; rate limiting keys on the client IP

  const fastnOrigin = originOf(config.fastn.host);
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // the Fastn widget is a cross-origin iframe
    // Helmet defaults COOP to same-origin, which puts this page in its own browsing-context
    // group and severs window.opener on any popup. The Fastn widget signs connectors in via a
    // popup that reports back through window.opener, so with COOP on, that popup loses its
    // opener and lands on about:blank instead of the provider's authorization page.
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", ...(fastnOrigin ? [fastnOrigin] : [])],
        frameAncestors: ["'self'"],
      },
    },
  }));
  app.use(express.json({ limit: '100kb' }));

  const withCustomer = loadCustomer(db, config);
  const api = express.Router();
  api.use(syncEventsRouter(db, config, withCustomer));
  api.use(workspaceRouter(db, withCustomer));
  api.use(fastnTokenRouter(db, config, withCustomer, fetchImpl));
  api.use(ordersRouter(db, withCustomer));
  api.use(healthRouter(db));
  api.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } }));
  app.use('/api', api);

  // Built web app, with client-side routing fallback.
  const indexHtml = path.join(config.webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(indexHtml));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    let code = err.code || 'INTERNAL';
    let message = err.message;
    if (err.type === 'entity.too.large') { status = 413; code = 'TOO_LARGE'; message = 'Body larger than 100 KB'; }
    else if (err.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'Body is not valid JSON'; }
    if (status >= 500 && status !== 502) {
      console.error(`${req.method} ${req.path} failed:`, err.message); // message only: never tokens or keys
      message = 'Something went wrong';
    }
    res.status(status).json({ error: { code, message } });
  });

  return app;
}
