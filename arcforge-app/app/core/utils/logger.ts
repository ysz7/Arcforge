/**
 * Simple structured logger for core and main process.
 * Levels: debug, info, warn, error.
 * Output: console + optional file (dev).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';
let logToFile = false;

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function setLogToFile(enabled: boolean): void {
  logToFile = enabled;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function formatMessage(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}

function log(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const formatted = formatMessage(level, context, message, meta);
  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log('debug', context, msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log('info', context, msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log('warn', context, msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log('error', context, msg, meta),
  };
}
