import { Router, Request, Response } from 'express';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const router = Router();

// Ensure logs directory exists
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const clientLogFile = join(logsDir, 'client.log');
const errorLogFile = join(logsDir, 'errors.log');

interface ClientLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  stack?: string;
  componentStack?: string;
}

function formatLogEntry(entry: ClientLogEntry, req: Request): string {
  const timestamp = entry.timestamp || new Date().toISOString();
  const userAgent = entry.userAgent || req.headers['user-agent'] || 'unknown';
  const url = entry.url || req.headers.referer || 'unknown';

  let logLine = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;

  if (entry.data) {
    logLine += `\n  Data: ${JSON.stringify(entry.data, null, 2).replace(/\n/g, '\n  ')}`;
  }

  if (entry.stack) {
    logLine += `\n  Stack: ${entry.stack.replace(/\n/g, '\n  ')}`;
  }

  if (entry.componentStack) {
    logLine += `\n  Component Stack: ${entry.componentStack.replace(/\n/g, '\n  ')}`;
  }

  logLine += `\n  URL: ${url}`;
  logLine += `\n  User-Agent: ${userAgent}`;
  logLine += '\n' + '='.repeat(80) + '\n';

  return logLine;
}

// POST /api/logs - Receive client logs
router.post('/', (req: Request, res: Response) => {
  try {
    const entries: ClientLogEntry[] = Array.isArray(req.body) ? req.body : [req.body];

    for (const entry of entries) {
      const logLine = formatLogEntry(entry, req);

      // Write to appropriate log file
      appendFileSync(clientLogFile, logLine);

      // Also write errors to dedicated error log
      if (entry.level === 'error') {
        appendFileSync(errorLogFile, logLine);
      }

      // Also log to server console for real-time monitoring
      const consoleMethod = entry.level === 'error' ? console.error
        : entry.level === 'warn' ? console.warn
        : console.log;

      consoleMethod(`[CLIENT ${entry.level.toUpperCase()}] ${entry.message}`, entry.data || '');
    }

    res.status(200).json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Error writing client log:', error);
    res.status(500).json({ error: 'Failed to write log' });
  }
});

// GET /api/logs - Read recent logs (for debugging)
router.get('/', (req: Request, res: Response) => {
  try {
    const type = req.query.type === 'errors' ? errorLogFile : clientLogFile;
    const lines = parseInt(req.query.lines as string) || 100;

    if (!existsSync(type)) {
      res.json({ logs: '', message: 'No logs yet' });
      return;
    }

    const content = readFileSync(type, 'utf-8');
    const allLines = content.split('\n');
    const recentLines = allLines.slice(-lines).join('\n');

    res.type('text/plain').send(recentLines);
  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// GET /api/logs/stats - Get log stats
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = {
      clientLog: existsSync(clientLogFile) ? {
        size: statSync(clientLogFile).size,
        modified: statSync(clientLogFile).mtime,
      } : null,
      errorLog: existsSync(errorLogFile) ? {
        size: statSync(errorLogFile).size,
        modified: statSync(errorLogFile).mtime,
      } : null,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// DELETE /api/logs - Clear logs
router.delete('/', (_req: Request, res: Response) => {
  try {
    const { writeFileSync } = require('fs');
    writeFileSync(clientLogFile, '');
    writeFileSync(errorLogFile, '');
    res.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

export default router;
