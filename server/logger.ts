import fs from 'node:fs';
import path from 'node:path';
import { formatWithOptions } from 'node:util';

const LOG_TO_FILE = (process.env.LOG_TO_FILE ?? 'true').toLowerCase() !== 'false';
const LOG_MAX_MB = Number.parseInt(process.env.LOG_MAX_MB ?? '20', 10);
const maxBytes =
  Number.isFinite(LOG_MAX_MB) && LOG_MAX_MB > 0 ? LOG_MAX_MB * 1024 * 1024 : 20 * 1024 * 1024;

const defaultLogPath = path.resolve('./data/logs/prism-server.log');
const configuredLogPath = (process.env.LOG_FILE ?? '').trim();
const logFilePath = configuredLogPath ? path.resolve(configuredLogPath) : defaultLogPath;
const logDir = path.dirname(logFilePath);

const stderrWrite = process.stderr.write.bind(process.stderr);

function ensureLogDir() {
  if (!LOG_TO_FILE) return;
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
}

function rotateIfNeeded() {
  if (!LOG_TO_FILE) return;
  if (!fs.existsSync(logFilePath)) return;

  try {
    const stat = fs.statSync(logFilePath);
    if (stat.size < maxBytes) return;
    const rotatedPath = `${logFilePath}.1`;
    if (fs.existsSync(rotatedPath)) fs.unlinkSync(rotatedPath);
    fs.renameSync(logFilePath, rotatedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderrWrite(`[Prism][LOGGER] rotate failed: ${message}\n`);
  }
}

function writeLog(level: string, args: unknown[]) {
  if (!LOG_TO_FILE) return;
  try {
    rotateIfNeeded();
    const text = formatWithOptions({ colors: false, depth: 6, maxArrayLength: 50 }, ...args);
    const line = `${new Date().toISOString()} [${level}] ${text}\n`;
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderrWrite(`[Prism][LOGGER] write failed: ${message}\n`);
  }
}

function patchConsole() {
  const globalKey = '__prism_console_patched__';
  const g = globalThis as Record<string, unknown>;
  if (g[globalKey]) return;
  g[globalKey] = true;

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = (...args: unknown[]) => {
    original.log(...args);
    writeLog('INFO', args);
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    writeLog('INFO', args);
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    writeLog('WARN', args);
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    writeLog('ERROR', args);
  };
  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    writeLog('DEBUG', args);
  };
}

ensureLogDir();
patchConsole();

if (LOG_TO_FILE) {
  console.info(`[Prism][LOGGER] writing logs to ${logFilePath}`);
}

process.on('uncaughtException', (error) => {
  console.error('[Prism] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Prism] Unhandled rejection:', reason);
});
