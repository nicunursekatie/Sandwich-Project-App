import { logger } from '@/lib/logger';

// WebSocket connection utility to handle various deployment environments
// This helps fix WebSocket URL construction issues across different platforms

export interface WebSocketConfig {
  path: string;
  protocol?: 'ws' | 'wss';
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
}

const sanitizePath = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

function applyWebSocketProtocol(url: URL, forcedProtocol?: 'ws' | 'wss') {
  if (forcedProtocol) {
    url.protocol = forcedProtocol;
    return;
  }

  if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  }
}

export function getWebSocketUrl(config: WebSocketConfig): string {
  if (typeof window === 'undefined') return '';

  const { path, protocol: forcedProtocol } = config;
  const sanitizedPath = sanitizePath(path);

  const preferredBase =
    config.baseUrl ??
    import.meta.env.VITE_WS_BASE_URL ??
    import.meta.env.VITE_API_BASE_URL ??
    null;

  if (preferredBase) {
    try {
      const normalizedBase = preferredBase.includes('://')
        ? preferredBase
        : `https://${preferredBase}`;
      const base = new URL(normalizedBase);
      applyWebSocketProtocol(base, forcedProtocol);
      const resolved = new URL(sanitizedPath, base);
      applyWebSocketProtocol(resolved, forcedProtocol);
      logger.log('WebSocket URL (from preferred base):', resolved.toString());
      return resolved.toString();
    } catch (error) {
      logger.error('Invalid WebSocket base URL provided', {
        preferredBase,
        error,
      });
    }
  }

  const location = window.location;
  const protocol =
    forcedProtocol || (location.protocol === 'https:' ? 'wss:' : 'ws:');
  const hostname = location.hostname || 'localhost';
  const defaultPort =
    location.port ||
    (hostname === 'localhost' || hostname === '127.0.0.1' ? '5000' : '');
  const portSegment = defaultPort ? `:${defaultPort}` : '';
  const host = `${hostname}${portSegment}`;

  logger.log('WebSocket URL Construction Debug (fallback):', {
    hostname,
    port: location.port,
    protocol,
    path: sanitizedPath,
    fullHost: location.host,
    origin: location.origin,
  });

  const url = `${protocol}//${host}${sanitizedPath}`;
  logger.log('Final WebSocket URL (fallback):', url);

  return url;
}

export function createWebSocketConnection(
  config: WebSocketConfig,
  options: {
    onOpen?: (ws: WebSocket) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    autoReconnect?: boolean;
  } = {}
): { ws: WebSocket | null; cleanup: () => void } {
  const { onOpen, onMessage, onError, onClose, autoReconnect = true } = options;
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isCleanedUp = false;

  const connect = () => {
    if (isCleanedUp) return;

    try {
      const url = getWebSocketUrl(config);
      logger.log(`Attempting WebSocket connection to: ${url}`);

      ws = new WebSocket(url);

      ws.onopen = (event) => {
        logger.log('WebSocket connected successfully');
        reconnectAttempts = 0;
        onOpen?.(ws!);
      };

      ws.onmessage = (event) => {
        onMessage?.(event);
      };

      ws.onerror = (event) => {
        logger.error('WebSocket error:', event);
        onError?.(event);
      };

      ws.onclose = (event) => {
        logger.log('WebSocket closed:', event.code, event.reason);
        onClose?.(event);

        // Auto-reconnect if not a normal closure and not cleaned up
        if (autoReconnect && !isCleanedUp && event.code !== 1000) {
          const maxRetries = config.maxRetries || 5;
          if (reconnectAttempts < maxRetries) {
            reconnectAttempts++;
            const delay = (config.retryDelay || 5000) * reconnectAttempts;
            logger.log(`Attempting reconnect ${reconnectAttempts}/${maxRetries} in ${delay}ms`);

            reconnectTimeout = setTimeout(connect, delay);
          } else {
            logger.error('Max reconnection attempts reached');
          }
        }
      };

    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      onError?.(new Event('error'));
    }
  };

  const cleanup = () => {
    isCleanedUp = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, 'Component cleanup');
    }
  };

  // Start initial connection
  connect();

  return { ws, cleanup };
}