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
  build: { chunkSizeWarningLimit: 1500 },
})
