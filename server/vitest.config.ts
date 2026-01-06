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
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '**/*.test.ts'],
    },
    pool: 'forks',
    deps: {
      inline: [/node:/],
    },
  },
});
