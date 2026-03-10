import 'dotenv/config';
import './logger.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { db } from './db.js';

const PORT = parseInt(process.env.SERVER_PORT ?? '3001');
const app = createApp();
const server = createServer(app);

// Periodic cleanup of expired sessions and password reset tokens (every hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const cleanupExpired = db.transaction(() => {
  db.prepare('DELETE FROM sessions WHERE expires_at <= unixepoch()').run();
  db.prepare(
    'DELETE FROM password_reset_tokens WHERE expires_at <= unixepoch() OR used_at IS NOT NULL',
  ).run();
});

const cleanupTimer = setInterval(() => {
  try {
    cleanupExpired();
  } catch (err) {
    console.error('[Prism] Session cleanup failed:', err);
  }
}, CLEANUP_INTERVAL_MS);

// Run once on startup to clear any stale sessions from a previous run
try {
  cleanupExpired();
} catch (err) {
  console.error('[Prism] Initial session cleanup failed:', err);
}

server.listen(PORT, () => {
  console.log(`[Prism] Server running on http://localhost:${PORT}`);
});

function shutdown(signal: string) {
  console.log(`[Prism] ${signal} received, shutting down gracefully...`);
  clearInterval(cleanupTimer);
  server.close(() => {
    console.log('[Prism] HTTP server closed');
    db.close();
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[Prism] Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
