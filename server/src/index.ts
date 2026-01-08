import { config } from 'dotenv';
import path from 'node:path';

// Load .env from project root (works regardless of cwd)
config({ path: path.resolve(process.cwd(), '.env') });
// Also try parent dir for when running from server workspace
config({ path: path.resolve(process.cwd(), '..', '.env') });
import express from 'express';
import cors from 'cors';
import { initDatabase, closeDatabase } from './db/connection.js';
import gamesRouter from './routes/games.js';
import syncRouter from './routes/sync.js';
import logsRouter from './routes/logs.js';
import collectionsRouter from './routes/collections.js';
import { ensureCoversDir } from './services/localCoverService.js';
import { ensureAssetDirs } from './services/localAssetsService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Ensure asset directories exist and serve static files
ensureCoversDir();
ensureAssetDirs();

const coversPath = path.resolve(process.cwd(), 'data', 'covers');
const heroesPath = path.resolve(process.cwd(), 'data', 'heroes');
const logosPath = path.resolve(process.cwd(), 'data', 'logos');

app.use('/covers', express.static(coversPath, {
  maxAge: '7d', // Cache covers for 7 days
  immutable: true,
}));

app.use('/heroes', express.static(heroesPath, {
  maxAge: '7d', // Cache heroes for 7 days
  immutable: true,
}));

app.use('/logos', express.static(logosPath, {
  maxAge: '7d', // Cache logos for 7 days
  immutable: true,
}));

// Routes
app.use('/api/games', gamesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/logs', logsRouter);
app.use('/api/collections', collectionsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Steam sync configured: ${!!(process.env.STEAM_API_KEY && process.env.STEAM_USER_ID)}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  shutdown();
});

export default app;
