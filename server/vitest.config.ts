import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests run without Firebase credentials — bypass auth verification.
    // This is the same bypass used in local development.
    env: {
      FIREBASE_AUTH_DISABLED: '1',
    },
  },
});
