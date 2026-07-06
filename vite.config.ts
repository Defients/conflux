import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      plugins: [react()],
      test: {
        globals: true,
        environment: 'node',
        include: ['shared/**/*.test.ts'],
      },
      build: {
        target: 'es2020',
        minify: 'esbuild' as const,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
              'vendor-colyseus': ['colyseus.js'],
            },
          },
        },
      },
    };
});
