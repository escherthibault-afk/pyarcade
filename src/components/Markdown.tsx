import { renderMarkdown } from '../lib/markdown'
import { highlightPython } from '../lib/highlight'

export function Markdown({ src, className = '' }: { src: string; className?: string }) {
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(src) }} />
}

export function CodeBlock({ code, className = '' }: { code: string; className?: string }) {
  return (
    <pre className={`overflow-x-auto rounded-xl border border-line bg-bg2 p-3 font-mono text-[0.88rem] leading-relaxed ${className}`}>
      <code dangerouslySetInnerHTML={{ __html: highlightPython(code.replace(/\n$/, '')) }} />
    </pre>
  )
}
