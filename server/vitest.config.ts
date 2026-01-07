import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [/^node:/],
    },
  },
  optimizeDeps: {
    exclude: ['node:sqlite', 'node:path', 'node:fs', 'node:url'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        'src/index.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
    pool: 'forks',
    deps: {
      inline: [/node:/],
    },
  },
});
