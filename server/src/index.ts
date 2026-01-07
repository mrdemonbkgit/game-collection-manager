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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

export default app;
