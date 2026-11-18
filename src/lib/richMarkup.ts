/** Parses rich markup ("[bold green]OK[/]", "[black on #6aaa64] A [/]") into styled segments. */
export type Segment = { text: string; style: Record<string, string> }

const NAMED: Record<string, string> = {
  black: '#1b1b1f', red: '#ef4444', green: '#22c55e', yellow: '#eab308', blue: '#3b82f6', magenta: '#d946ef', cyan: '#06b6d4',
  white: '#f5f5f5', grey: '#8b8b97', gray: '#8b8b97', orange: '#f97316', purple: '#a855f7',
  bright_black: '#6b7280', bright_red: '#f87171', bright_green: '#4ade80', bright_yellow: '#fde047', bright_blue: '#60a5fa',
  bright_magenta: '#f0abfc', bright_cyan: '#67e8f9', bright_white: '#ffffff', dark_green: '#15803d', dark_orange: '#c2410c',
  grey50: '#7f7f7f', grey30: '#4d4d4d', grey70: '#b3b3b3', gold1: '#ffd700', orange1: '#ffaf00',
}

function color(c: string): string | undefined {
  c = c.trim().toLowerCase()
  if (/^#[0-9a-f]{3,8}$/.test(c)) return c
  const rgb = c.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (rgb) return `rgb(${rgb[1]},${rgb[2]},${rgb[3]})`
  return NAMED[c]
}

export function styleOf(spec: string): Record<string, string> {
  const st: Record<string, string> = {}
  const words = spec.split(/\s+/).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase()
    if (w === 'bold' || w === 'b') st.fontWeight = '700'
    else if (w === 'italic' || w === 'i') st.fontStyle = 'italic'
    else if (w === 'underline' || w === 'u') st.textDecoration = 'underline'
    else if (w === 'dim') st.opacity = '0.65'
    else if (w === 'reverse') st.filter = 'invert(1)'
    else if (w === 'on' && words[i + 1]) {
      const c = color(words[++i])
      if (c) st.background = c
    } else {
      const c = color(w)
      if (c) st.color = c
    }
  }
  return st
}

export function parseMarkup(src: string): Segment[] {
  const segs: Segment[] = []
  const stack: Record<string, string>[] = []
  let buf = ''
  const cur = () => Object.assign({}, ...stack)
  const flush = () => {
    if (buf) segs.push({ text: buf, style: cur() })
    buf = ''
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '\\' && src[i + 1] === '[') {
      buf += '['
      i += 2
      continue
    }
    if (c === '[') {
      const j = src.indexOf(']', i)
      const tag = j > i ? src.slice(i + 1, j) : ''
      if (j > i && /^\/?[\w#\s(),.-]*$/.test(tag)) {
        flush()
        if (tag.startsWith('/')) stack.pop()
        else stack.push(styleOf(tag))
        i = j + 1
        continue
      }
    }
    buf += c
    i++
  }
  flush()
  return segs
}
