import type { Request } from 'express';

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    if (/^[\w.-]+(:\d+)?$/.test(value)) {
      const protocol =
        value.startsWith('localhost') || value.startsWith('127.') ? 'http' : 'https';
      return `${protocol}://${value}`;
    }
    return null;
  }
}

function resolveHostFromRequest(req?: Request): string | null {
  if (!req) return null;
  const host = req.get('host');
  if (!host) return null;
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}`;
}

export function getConfiguredAppBaseUrl(): string | null {
  return normalizeUrl(process.env.APP_BASE_URL);
}

export function getConfiguredApiBaseUrl(): string | null {
  return (
    normalizeUrl(process.env.API_BASE_URL) ??
    normalizeUrl(process.env.APP_BASE_URL)
  );
}

export function getEffectiveAppBaseUrl(req?: Request): string {
  return (
    getConfiguredAppBaseUrl() ??
    resolveHostFromRequest(req) ??
    'http://localhost:5000'
  );
}

export function getEffectiveApiBaseUrl(req?: Request): string {
  return (
    getConfiguredApiBaseUrl() ??
    resolveHostFromRequest(req) ??
    'http://localhost:5000'
  );
}

export function joinUrl(base: string, path: string): string {
  const sanitizedBase = base.replace(/\/+$/, '');
  const sanitizedPath = path.replace(/^\/+/, '');
  return `${sanitizedBase}/${sanitizedPath}`;
}

