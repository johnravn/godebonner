import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version: string }
const react95Core = path.resolve(__dirname, 'node_modules/@react95/core/dist')
const react95IconsPng = path.resolve(
  __dirname,
  'node_modules/@react95/icons/png',
)
const react95IconsPublic = path.resolve(__dirname, 'public/react95-icons')

function ensureReact95IconsPublic(): Plugin {
  let command: 'build' | 'serve' = 'serve'

  function sync() {
    if (!fs.existsSync(react95IconsPng)) return

    if (command === 'build') {
      fs.rmSync(react95IconsPublic, { recursive: true, force: true })
      fs.cpSync(react95IconsPng, react95IconsPublic, { recursive: true })
      return
    }

    try {
      const stat = fs.lstatSync(react95IconsPublic)
      if (stat.isSymbolicLink() || stat.isDirectory()) return
      fs.rmSync(react95IconsPublic, { recursive: true, force: true })
    } catch {
      // missing
    }

    try {
      fs.symlinkSync(react95IconsPng, react95IconsPublic, 'dir')
    } catch {
      fs.cpSync(react95IconsPng, react95IconsPublic, { recursive: true })
    }
  }

  return {
    name: 'react95-icons-public',
    config(_config, env) {
      command = env.command
    },
    buildStart: sync,
    configureServer: sync,
  }
}

/** @react95/core Checkbox CSS embeds SVG data-URLs with raw `'` inside `url('...')`, which CSS parsers drop. */
function fixReact95CheckboxCss(): Plugin {
  const checkUrl =
    'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%227%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M.014%201.897L0%205.905h.998l.015%201.084h.998v1.013h.984v-.999l.999.015.014-.885h.984V5.006h.999V3.994h.998L7.003%200l-.998.014v.999L5.006.998V2.14l-.998.015v.856l-.998.014v.984H1.997l-.014-.97-.985-.014L.984%201.91l-.97-.014z%22%2F%3E%3C%2Fsvg%3E")'
  const checkDisabledUrl =
    'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%227%22%20height%3D%228%22%3E%3Cpath%20fill%3D%22gray%22%20d%3D%22M.014%201.897L0%205.905h.998l.015%201.084h.998v1.013h.984v-.999l.999.015.014-.885h.984V5.006h.999V3.994h.998L7.003%200l-.998.014v.999L5.006.998V2.14l-.998.015v.856l-.998.014v.984H1.997l-.014-.97-.985-.014L.984%201.91l-.97-.014z%22%2F%3E%3C%2Fsvg%3E")'

  return {
    name: 'fix-react95-checkbox-css',
    transform(code, id) {
      const normalized = id.replace(/\\/g, '/')
      if (!normalized.includes('Checkbox.css.ts.vanilla.css')) return null
      if (!code.includes("url('data:image/svg+xml,")) return null

      let replaced = 0
      const next = code.replace(
        /background-image:\s*url\('data:image\/svg\+xml,[\s\S]*?\);/g,
        (match) => {
          replaced += 1
          const isDisabled = /fill=['"]gray['"]|fill=%27gray%27|fill%3D%22gray%22/.test(
            match,
          )
          return `background-image: ${isDisabled ? checkDisabledUrl : checkUrl};`
        },
      )

      return replaced > 0 ? next : null
    },
  }
}

/**
 * React95 TaskBar calls `focus(lastModal.id)` inside a `setModalWindows` updater
 * when the active window is removed. That updates Modal state during TaskBar's
 * setState and triggers React's "Cannot update a component while rendering a
 * different component" warning. Defer focus to a microtask.
 */
function patchReact95TaskBarFocus(code: string): string | null {
  if (code.includes('queueMicrotask(() => focus(lastModal.id))')) {
    return null
  }
  if (!code.includes('focus(lastModal.id)')) {
    return null
  }

  const braced =
    /if\s*\(\s*activeWindow\s*===\s*data\.id\s*&&\s*lastModal\s*\)\s*\{\s*focus\(\s*lastModal\.id\s*\)\s*;\s*\}/
  const inline =
    /if\s*\(\s*activeWindow\s*===\s*data\.id\s*&&\s*lastModal\s*\)\s*focus\(\s*lastModal\.id\s*\)\s*;/

  if (braced.test(code)) {
    return code.replace(
      braced,
      'if (activeWindow === data.id && lastModal) { queueMicrotask(() => focus(lastModal.id)); }',
    )
  }
  if (inline.test(code)) {
    return code.replace(
      inline,
      'if (activeWindow === data.id && lastModal) queueMicrotask(() => focus(lastModal.id));',
    )
  }
  return null
}

function fixReact95TaskBarFocus(): Plugin {
  return {
    name: 'fix-react95-taskbar-focus',
    transform(code, id) {
      const normalized = id.replace(/\\/g, '/')
      const isTaskBar =
        normalized.includes('/TaskBar/TaskBar.') ||
        normalized.endsWith('@react95_core.js')
      if (!isTaskBar) return null
      return patchReact95TaskBarFocus(code)
    },
  }
}

/** Patches TaskBar while Vite prebundles `@react95/core`. */
function react95TaskBarFocusEsbuildPlugin() {
  return {
    name: 'fix-react95-taskbar-focus-esbuild',
    setup(build: {
      onLoad: (
        options: { filter: RegExp },
        callback: (args: { path: string }) => Promise<{
          contents: string
          loader: 'js'
        } | null>,
      ) => void
    }) {
      build.onLoad({ filter: /TaskBar[/\\]TaskBar\.mjs$/ }, async (args) => {
        const source = await fs.promises.readFile(args.path, 'utf8')
        const patched = patchReact95TaskBarFocus(source)
        if (!patched) return null
        return { contents: patched, loader: 'js' }
      })
    },
  }
}

const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    tsconfigPaths: true,
    // Prevent duplicate React copies (invalid hook call in AwaitInner / HMR).
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@react95/core/GlobalStyle',
        replacement: path.resolve(
          react95Core,
          'esm/GlobalStyle/GlobalStyle.css.ts.vanilla.css',
        ),
      },
      {
        find: '@react95/core/themes/win95.css',
        replacement: path.resolve(
          react95Core,
          'esm/themes/win95.css.ts.vanilla.css',
        ),
      },
      {
        find: '@react95/core',
        replacement: react95Core,
      },
      {
        find: '@react95/icons/png',
        replacement: react95IconsPng,
      },
      {
        find: '@react95/icons',
        replacement: path.resolve(
          __dirname,
          'src/shared/ui/react95-icons-shim.tsx',
        ),
      },
    ],
  },
  // Pre-bundle React95 transitive deps on first scan so Vite does not re-optimize
  // mid-request (missing hashed react-*.js / invalid hook call after reload).
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@react95/core',
      '@vanilla-extract/recipes/createRuntimeFn',
      'classnames',
      'nanoid',
      'rainbow-sprinkles/createRuntimeFn',
      'usehooks-ts',
    ],
    esbuildOptions: {
      plugins: [react95TaskBarFocusEsbuildPlugin()],
    },
  },
  // TanStack Start sets SSR optimizeDeps.noDiscovery=true with an empty include
  // list, so React can resolve twice (node_modules + client prebundle) and hooks fail.
  environments: {
    ssr: {
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-dom/server',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
        ],
      },
    },
  },
  plugins: [
    ensureReact95IconsPublic(),
    fixReact95CheckboxCss(),
    fixReact95TaskBarFocus(),
    devtools(),
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    // Required for Vercel (and other hosts): emits .vercel/output Build Output API.
    nitro(),
    viteReact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'generateSW',
      // Intermediate dir; scripts/generate-sw.mjs rewrites into Nitro public output.
      outDir: 'dist/client',
      integration: {
        // Run before Nitro collects public assets (TanStack Start multi-env build)
        closeBundleOrder: 'pre',
      },
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
        'logo1080.png',
      ],
      manifest: {
        id: '/',
        name: 'Godebonner',
        short_name: 'Godebonner',
        description: 'Slå opp gratiskuponger med telefonnummer',
        lang: 'no',
        dir: 'ltr',
        theme_color: '#008080',
        background_color: '#008080',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/?source=pwa',
        categories: ['food', 'lifestyle'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,ico,svg,woff2,webmanifest}',
          'pwa-*.png',
          'apple-touch-icon.png',
          'logo1080.png',
        ],
        globIgnores: ['**/react95-icons/**'],
        navigateFallback: '/_shell.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_serverFn\//],
        // Shell is written during prerender after the PWA glob — re-generated in scripts/generate-sw.mjs
        additionalManifestEntries: [
          { url: '/_shell.html', revision: Date.now().toString(36) },
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('supabase.co') ||
              url.hostname.endsWith('supabase.in'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    watch: {
      // Vitest / Playwright artifacts — changes must not trigger SPA reloads (404 noise).
      ignored: [
        '**/coverage/**',
        '**/playwright-report/**',
        '**/test-results/**',
        '**/blob-report/**',
      ],
    },
  },
  build: {
    cssMinify: false,
  },
})

export default config
