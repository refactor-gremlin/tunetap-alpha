/**
 * Application Logger Utility
 *
 * This logger provides consistent logging throughout the application.
 * Debug logs are controlled and only shown in the following cases:
 * 1. When in development mode (import.meta.env.DEV is true)
 * 2. When the logged-in user matches a configured list of privileged debug users
 * 3. When debug mode is explicitly enabled via logger.setDebugMode(true)
 *
 * Other log levels (info, warn, error, success) are always shown.
 *
 * Logs are also sent to Sentry for structured logging and monitoring.
 *
 * SECURITY NOTE: This logger sanitizes PII before sending to Sentry.
 * Do not pass sensitive data like passwords, tokens, or personal identifiers
 * directly to logger functions. Use dedicated error channels for PII.
 */

// Type for Sentry logger interface
interface SentryLogger {
  trace?: (message: string, attributes?: Record<string, unknown>) => void;
  debug?: (message: string, attributes?: Record<string, unknown>) => void;
  info?: (message: string, attributes?: Record<string, unknown>) => void;
  warn?: (message: string, attributes?: Record<string, unknown>) => void;
  error?: (message: string, attributes?: Record<string, unknown>) => void;
  fatal?: (message: string, attributes?: Record<string, unknown>) => void;
}

// Cache for Sentry logger to avoid repeated checks
let sentryLoggerCache: SentryLogger | null = null;
let sentryCheckDone = false;

// Helper to safely get Sentry logger (synchronous check)
function getSentryLogger(): SentryLogger | null {
  // Return cached result if check was already done
  if (sentryCheckDone) {
    return sentryLoggerCache;
  }

  sentryCheckDone = true;

  try {
    // Check if Sentry is available in global scope (initialized in hooks)
    if (typeof globalThis !== "undefined") {
      const globalSentry = (globalThis as Record<string, unknown>).Sentry as
        | { logger?: SentryLogger }
        | undefined;
      if (globalSentry?.logger) {
        sentryLoggerCache = globalSentry.logger;
        return sentryLoggerCache;
      }
    }

    // Try to access Sentry from module cache (if already imported elsewhere)
    // This is a best-effort check - if Sentry isn't initialized yet, we'll skip it
    // The consoleLoggingIntegration in hooks will still capture console.log calls
    sentryLoggerCache = null;
  } catch {
    // Sentry not available
    sentryLoggerCache = null;
  }

  return sentryLoggerCache;
}

// Helper to send log to Sentry with structured attributes and PII sanitization
function sendToSentry(
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
  source: string,
  message: string,
  ...args: unknown[]
): void {
  try {
    const sentryLogger = getSentryLogger();
    if (!sentryLogger) return;

    // Build attributes object from args with PII sanitization
    const attributes: Record<string, unknown> = { source };

    // Process args with sanitization
    args.forEach((arg, index) => {
      if (
        arg &&
        typeof arg === "object" &&
        !Array.isArray(arg) &&
        arg !== null
      ) {
        const obj = arg as Record<string, unknown>;
        
        // Skip logging entire object if it contains suspected PII
        if (containsPII(obj)) {
          attributes[`obj${index}_sanitized`] = '[CONTAINS_PII_REDACTED]';
        } else {
          // Sanitize the object and merge with prefixed keys
          const sanitized = sanitizeObject(obj);
          Object.entries(sanitized).forEach(([key, value]) => {
            const prefixedKey = `obj${index}_${key}`;
            attributes[prefixedKey] = value;
          });
        }
      } else if (typeof arg === 'string' && containsPII(arg)) {
        // Redact strings that appear to contain PII
        attributes[`arg${index}`] = '[REDACTED_PII]';
      } else if (arg !== undefined && arg !== null) {
        // Store safe non-object args with indexed keys
        attributes[`arg${index}`] = arg;
      }
    });

    // Use Sentry logger with formatted message and sanitized attributes
    const fullMessage = `[${source}] ${message}`;

    switch (level) {
      case "trace":
        if (sentryLogger.trace) {
          sentryLogger.trace(fullMessage, attributes);
        }
        break;
      case "debug":
        if (sentryLogger.debug) {
          sentryLogger.debug(fullMessage, attributes);
        }
        break;
      case "info":
        if (sentryLogger.info) {
          sentryLogger.info(fullMessage, attributes);
        }
        break;
      case "warn":
        if (sentryLogger.warn) {
          sentryLogger.warn(fullMessage, attributes);
        }
        break;
      case "error":
        if (sentryLogger.error) {
          sentryLogger.error(fullMessage, attributes);
        }
        break;
      case "fatal":
        if (sentryLogger.fatal) {
          sentryLogger.fatal(fullMessage, attributes);
        }
        break;
    }
  } catch {
    // Silently fail if Sentry is not available or errors occur
    // This ensures logging never breaks the application
  }
}

const colors = {
  reset: "",
  fg: {
    blue: "",
    yellow: "",
    red: "",
    green: "",
    gray: "",
  },
};

// Only use ANSI colors in Node.js environment
if (
  typeof process !== "undefined" &&
  process.versions &&
  process.versions.node
) {
  colors.reset = "\x1b[0m";
  colors.fg = {
    blue: "\x1b[34m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    gray: "\x1b[90m",
  };
}

type LogLevel = "info" | "warn" | "error" | "success" | "debug";

// Store debug mode state
let isDebugMode = false;
let currentUsername = "";

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  source: string,
  message: string,
): string {
  const timestamp = getTimestamp();
  let color = colors.fg.blue; // default color

  switch (level) {
    case "info":
      color = colors.fg.blue;
      break;
    case "warn":
      color = colors.fg.yellow;
      break;
    case "error":
      color = colors.fg.red;
      break;
    case "success":
      color = colors.fg.green;
      break;
    case "debug":
      color = colors.fg.gray;
      break;
  }

  return `${color}[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}${colors.reset}`;
}

// Helper to detect and filter potential PII patterns
const PII_PATTERNS: RegExp[] = [
  /password/i,
  /token/i,
  /secret/i,
  /\bkey\b\s*=?/i,
  /auth/i,
  /credential/i,
  /session/i,
  /cookie/i,
  /bearer\s+/i,
  /basic\s+/i,
  // Email pattern
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // Phone pattern (basic)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  // Social security pattern
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Credit card pattern
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/
];

// Check if a string or object contains potential PII
function containsPII(value: string | Record<string, unknown>): boolean {
  if (typeof value === 'string') {
    return PII_PATTERNS.some(pattern => pattern.test(value));
  }
  
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).join(' ').toLowerCase();
    
    // Serialize object for pattern checks, handling circular refs and large inputs
    let values = '';
    try {
      values = JSON.stringify(value);
      // Truncate if too long to avoid performance issues
      if (values.length > 10000) {
        values = values.substring(0, 10000);
      }
    } catch {
      // Fallback for circular references or non-serializable values
      values = Object.values(value).toString();
    }
    
    // Check both keys and values for PII indicators
    return PII_PATTERNS.some(pattern => 
      pattern.test(keys) || pattern.test(values)
    );
  }
  
  return false;
}

// Sanitize object by removing or redacting PII
function sanitizeObject(
  obj: Record<string, unknown>,
  visited = new WeakSet<object>()
): Record<string, unknown> {
  // Handle circular references
  if (visited.has(obj)) {
    return { '[Circular]': true };
  }
  visited.add(obj);

  return Object.entries(obj).reduce((clean, [key, value]) => {
    const lowerKey = key.toLowerCase();
    
    // Safely convert value to string for PII checking
    let valueStr = '';
    if (typeof value === 'string') {
      valueStr = value;
    } else {
      try {
        valueStr = JSON.stringify(value);
      } catch {
        // Fallback for circular references or non-serializable values
        valueStr = String(value);
      }
    }
    
    // Check if key or value indicates PII
    if (PII_PATTERNS.some(pattern => pattern.test(lowerKey) || pattern.test(valueStr))) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      clean[key] = sanitizeObject(value as Record<string, unknown>, visited);
    } else {
      clean[key] = value;
    }
    
    return clean;
  }, {} as Record<string, unknown>);
}
function getPrivilegedDebugUsers(): Set<string> {
  const envVar = 
    (typeof process !== 'undefined' && process.env?.PRIVILEGED_DEBUG_USERS) ||
    (globalThis as { __PRIVILEGED_DEBUG_USERS__?: string }).__PRIVILEGED_DEBUG_USERS__;
  
  if (!envVar) return new Set();
  
  return new Set(
    envVar
      .split(',')
      .map(u => u.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Check if debug logs should be shown
function shouldShowDebugLogs(): boolean {
  const isDev =
    typeof import.meta !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (import.meta as any).env?.DEV === true;
  const envDebug =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.LOG_DEBUG === "true") ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__FORCE_DEBUG__ === true;

  // Debug is enabled if explicitly toggled, or in dev when env flag is set, or for a configured privileged user
  return (
    isDebugMode ||
    (isDev && envDebug) ||
    getPrivilegedDebugUsers().has(currentUsername.toLowerCase())
  );
}

export const logger = {
  info: (source: string, message: string, ...args: unknown[]) => {
    // Send to Sentry first
    sendToSentry("info", source, message, ...args);
    // Then output to console
    console.log(formatMessage("info", source, message), ...args);
  },
  warn: (source: string, message: string, ...args: unknown[]) => {
    // Send to Sentry first
    sendToSentry("warn", source, message, ...args);
    // Then output to console
    console.warn(formatMessage("warn", source, message), ...args);
  },
  error: (source: string, message: string, ...args: unknown[]) => {
    // Send to Sentry first
    sendToSentry("error", source, message, ...args);
    // Then output to console
    console.error(formatMessage("error", source, message), ...args);
  },
  success: (source: string, message: string, ...args: unknown[]) => {
    // Send to Sentry as info level (success is info level in Sentry)
    sendToSentry("info", source, message, ...args);
    // Then output to console
    console.log(formatMessage("success", source, message), ...args);
  },
  debug: (source: string, message: string, ...args: unknown[]) => {
    if (shouldShowDebugLogs()) {
      // Send to Sentry first (only if debug logs are enabled)
      sendToSentry("debug", source, message, ...args);
      // Then output to console
      console.log(formatMessage("debug", source, message), ...args);
    } else {
      // Even if not showing in console, send to Sentry if Sentry is available
      // This allows Sentry to capture debug logs even when console output is suppressed
      sendToSentry("debug", source, message, ...args);
    }
  },
  // Add a method to set the current username
  setUsername: (username: string) => {
    currentUsername = username;
  },
  // Add a method to explicitly set debug mode
  setDebugMode: (debug: boolean) => {
    isDebugMode = debug;
  },
  // Helper to check if debug logging is enabled
  isDebugEnabled: (): boolean => {
    return shouldShowDebugLogs();
  },
};
