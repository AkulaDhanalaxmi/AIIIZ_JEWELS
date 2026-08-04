/**
 * utils/logger.js
 *
 * Minimal structured logger. Swap this out for winston/pino in a
 * real deployment — the interface (info/warn/error) is kept small
 * on purpose so that swap is a one-file change.
 */

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${timestamp()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${timestamp()} - ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${timestamp()} - ${msg}`, meta),
};

module.exports = logger;
