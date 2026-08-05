import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'server/dist/**',
      '**/*.config.ts',
      '**/*.config.js',
      'eslint.config.js',
      'tailwind.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Existing codebase has case declarations and useless assignments
      // that would require refactoring. Warn for now.
      'no-case-declarations': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'server/src/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
