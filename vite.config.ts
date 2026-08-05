import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      plugins: [react(), tailwindcss()],
      test: {
        globals: true,
        environment: 'node',
        include: ['shared/**/*.test.ts', 'services/**/*.test.ts'],
      },
      build: {
        target: 'es2020',
        minify: 'esbuild' as const,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
                return 'vendor-react';
              }
              if (id.includes('node_modules/firebase/')) {
                return 'vendor-firebase';
              }
              if (id.includes('node_modules/colyseus')) {
                return 'vendor-colyseus';
              }
              if (id.includes('/events/') && id.endsWith('.tsx')) {
                return 'events-bundle';
              }
              if (id.includes('/shared/') && id.endsWith('.ts')) {
                return 'shared-bundle';
              }
            },
          },
        },
      },
    };
});
