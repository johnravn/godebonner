import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

/**
 * DB/RLS/RPC suite against local Supabase (test/CI only).
 * Requires: supabase start, then env from `supabase status -o env`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#': path.resolve(root, 'src'),
      '@': path.resolve(root, 'src'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/db/**/*.{test,spec}.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
