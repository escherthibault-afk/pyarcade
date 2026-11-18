import { highlightCode, classHighlighter } from '@lezer/highlight'
import { parser } from '@lezer/python'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Python code -> HTML with tok-* classes (static highlighting for statements). */
export function highlightPython(code: string): string {
  let html = ''
  try {
    highlightCode(
      code,
      parser.parse(code),
      classHighlighter,
      (text, classes) => {
        html += classes ? `<span class="${classes}">${escapeHtml(text)}</span>` : escapeHtml(text)
      },
      () => {
        html += '\n'
      },
    )
  } catch {
    return escapeHtml(code)
  }
  return html
}
