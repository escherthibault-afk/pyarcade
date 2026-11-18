import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { parse } from 'yaml'

/** Turns every `content/**\/*.yaml` import into a plain JS object at build time. */
function yamlPlugin(): Plugin {
  return {
    name: 'pyarcade-yaml',
    transform(src, id) {
      if (!/\.ya?ml$/.test(id)) return null
      return { code: `export default ${JSON.stringify(parse(src))};`, map: null }
    },
  }
}

export default defineConfig({
  // Relative base + HashRouter = works on GitHub Pages, Vercel or any static host.
  base: './',
  plugins: [react(), tailwindcss(), yamlPlugin()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // vendor chunks cached separately from the app and the content
        manualChunks(id: string) {
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer')) return 'codemirror'
          if (id.includes('node_modules/leaflet')) return 'leaflet'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'motion'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          if (id.includes('node_modules/zod') || id.includes('node_modules/marked')) return 'libs'
          if (id.includes('/content/') && id.endsWith('.yaml')) return 'content'
          return undefined
        },
      },
    },
  },
})
