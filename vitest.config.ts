import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: '#', replacement: path.resolve(root, 'src') },
      { find: '@', replacement: path.resolve(root, 'src') },
      {
        find: '@react95/core',
        replacement: path.resolve(root, 'src/test/stubs/react95-core.tsx'),
      },
      {
        find: '@react95/icons',
        replacement: path.resolve(root, 'src/test/stubs/react95-icons.tsx'),
      },
      {
        find: 'virtual:pwa-register/react',
        replacement: path.resolve(
          root,
          'src/test/stubs/virtual-pwa-register.tsx',
        ),
      },
      {
        find: 'virtual:pwa-register',
        replacement: path.resolve(
          root,
          'src/test/stubs/virtual-pwa-register.tsx',
        ),
      },
    ],
  },
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      'tests/db/**',
      'src/routeTree.gen.ts',
      'src/shared/types/database.types.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/shared/lib/phone.ts',
        'src/shared/auth/**',
        'src/shared/ui/custom-icon.ts',
        'src/shared/pwa/install-state.ts',
        'src/features/admin/member-csv-import.ts',
        'src/features/home/minesweeper.ts',
        'src/features/home/solitaire.ts',
        'src/features/home/resolve-desktop-open.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
})
