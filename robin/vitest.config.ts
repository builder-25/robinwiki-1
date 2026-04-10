import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      '@robin/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
      '@robin/agent': resolve(__dirname, '../packages/agent/src/index.ts'),
      '@robin/queue': resolve(__dirname, '../packages/queue/src/index.ts'),
    },
  },
})
