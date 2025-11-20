import { Request, Response, NextFunction } from 'express';

/**
 * Centralized CORS Configuration
 * 
 * Provides secure, environment-aware CORS configuration for both Express routes
 * and Socket.IO connections. Replaces scattered CORS configs with a single
 * source of truth that prevents security vulnerabilities.
 */

export interface CorsConfig {
  allowedOrigins: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  optionsSuccessStatus: number;
}

/**
 * Get allowed origins based on environment and current domain
 */
function toUrlList(value?: string): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function normalizeOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    // Allow bare domains (e.g., localhost:5173)
    if (/^[\w.-]+(:\d+)?$/.test(origin)) {
      const protocol = origin.startsWith('localhost') || origin.startsWith('127.') ? 'http' : 'https';
      return `${protocol}://${origin}`;
    }
    return null;
  }
}

function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  const addOrigin = (origin?: string) => {
    if (!origin) return;
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  };

  // Allow explicitly configured application URLs
  addOrigin(process.env.APP_BASE_URL);
  addOrigin(process.env.API_BASE_URL);
  addOrigin(process.env.APP_URL);

  // Additional explicit origins from environment variable (comma separated)
  toUrlList(process.env.ALLOWED_ORIGINS).forEach(addOrigin);

  // Development defaults for local usage
  if (!origins.size || process.env.NODE_ENV === 'development') {
    [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://localhost:3001',
      'https://127.0.0.1:3001',
      'https://localhost:5000',
      'https://127.0.0.1:5000',
      'https://localhost:5173',
      'https://127.0.0.1:5173',
    ].forEach(addOrigin);
  }

  return Array.from(origins);
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow same-origin requests (no origin header)
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // In development, allow any localhost or 127.0.0.1 variants
  if (process.env.NODE_ENV === 'development') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true;
    }
  }

  // Allow Firebase hosting domains
  if (origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
    return true;
  }

  // Allow Google Cloud Workstations (for Firebase development/preview)
  if (origin.includes('.cloudworkstations.dev')) {
    return true;
  }

  // Allow Cloud Run domains (for Firebase App Hosting)
  if (origin.endsWith('.run.app')) {
    return true;
  }

  // In production, only allow explicitly configured domains
  return false;
}

/**
 * Get the CORS configuration for Express middleware
 */
export function getExpressCorsConfig(): CorsConfig {
  return {
    allowedOrigins: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma'
    ],
    optionsSuccessStatus: 200
  };
}

/**
 * Get the CORS configuration for Socket.IO
 */
export function getSocketCorsConfig() {
  const allowedOrigins = getAllowedOrigins();
  
  return {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // Socket.IO passes undefined for same-origin requests
      if (!origin) {
        return callback(null, true);
      }
      
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 Socket.IO CORS: Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  };
}

/**
 * Express middleware for CORS handling
 */
export function createCorsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const config = getExpressCorsConfig();
    
    // Handle CORS for allowed origins
    if (isOriginAllowed(origin)) {
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
      } else {
        // Same-origin request
        res.header('Access-Control-Allow-Origin', 'null');
      }
    } else if (origin) {
      console.warn(`🚫 Express CORS: Blocked origin: ${origin}`);
      // Don't set any CORS headers for blocked origins
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    
    // Set other CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', config.methods.join(','));
    res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(','));
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(config.optionsSuccessStatus).end();
    } else {
      next();
    }
  };
}

/**
 * Log current CORS configuration (for debugging)
 */
export function logCorsConfig() {
  const allowedOrigins = getAllowedOrigins();
  console.log('🔒 CORS Configuration:');
  console.log('  Environment:', process.env.NODE_ENV || 'development');
  console.log('  Allowed Origins:', allowedOrigins);
  console.log('  Credentials:', true);
  console.log('  Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
}
