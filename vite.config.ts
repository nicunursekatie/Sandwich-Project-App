import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig(async ({ mode }) => {
  const isProduction = mode === 'production';

  const plugins = [react()];

  if (process.env.DISABLE_RUNTIME_ERROR_OVERLAY !== 'true') {
    plugins.push(runtimeErrorOverlay());
  }

  if (
    process.env.ENABLE_REPLIT_CARTOGRAPHER === 'true' ||
    (process.env.REPL_ID && !isProduction)
  ) {
    const { cartographer } = await import('@replit/vite-plugin-cartographer');
    plugins.push(cartographer());
  }

  const allowedHosts =
    process.env.VITE_ALLOWED_HOSTS?.split(',')
      .map((host) => host.trim())
      .filter((host) => host.length > 0) ?? ['all'];

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'client', 'src'),
        '@shared': path.resolve(import.meta.dirname, 'shared'),
        '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
      },
    },
    root: path.resolve(import.meta.dirname, 'client'),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
      minify: 'esbuild',
      sourcemap: isProduction ? 'hidden' : true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'wouter'],
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
            ],
            'query-vendor': ['@tanstack/react-query'],
          },
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      target: 'es2020',
      assetsInlineLimit: 4096,
    },
    server: {
      allowedHosts,
      host: true,
      fs: {
        strict: true,
        deny: ['**/.*'],
      },
      hmr: {
        overlay: true,
      },
      watch: {
        usePolling: false,
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    },
  };
});
