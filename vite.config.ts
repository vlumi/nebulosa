import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  resolve: {
    // satellite.js also ships an optional WASM propagator whose Emscripten glue targets Node; this app never loads it.
    alias: [{ find: /^#wasm-(single|multi)-thread$/, replacement: 'data:text/javascript,export default null' }],
  },
  build: {
    // The MapLibre vendor chunk, hashed and cached across deploys, is 1031 kB at 6.9 and sets the limit; the warning is for app code.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'maplibre', test: /node_modules\/maplibre-gl\// },
            { name: 'luma', test: /node_modules\/@(luma|loaders|probe)\.gl\// },
            { name: 'deck', test: /node_modules\/@(deck|math)\.gl\// },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.tsx'],
    },
  },
})
