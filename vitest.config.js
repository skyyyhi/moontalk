import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      // Vite doesn't recognise experimental node: builtins (e.g. node:sqlite).
      // Mark them all as external so Vite passes them straight to Node.
      name: 'node-builtins-external',
      enforce: 'pre',
      resolveId(id) {
        if (id.startsWith('node:')) return { id, external: true };
      },
    },
  ],
  test: {
    include: ['server/**/*.test.js'],
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--experimental-sqlite'],
      },
    },
  },
});
