import { Marked } from 'marked'
import { highlightPython, } from './highlight'

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const body = !lang || lang === 'python' || lang === 'py' ? highlightPython(text) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      return `<pre><code>${body}</code></pre>`
    },
  },
})

const cache = new Map<string, string>()
/** Content is ours (repository YAML), so rendering to HTML is safe. */
export function renderMarkdown(src: string): string {
  const hit = cache.get(src)
  if (hit) return hit
  const html = marked.parse(src ?? '', { async: false }) as string
  if (cache.size > 500) cache.clear()
  cache.set(src, html)
  return html
}
