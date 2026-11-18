import { defineConfig } from 'vitest/config'
import { parse } from 'yaml'

export default defineConfig({
  plugins: [
    {
      name: 'pyarcade-yaml',
      transform(src: string, id: string) {
        if (!/\.ya?ml$/.test(id)) return null
        return { code: `export default ${JSON.stringify(parse(src))};`, map: null }
      },
    },
  ],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
