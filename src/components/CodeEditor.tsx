import { useEffect, useRef } from 'react'
import { EditorState, Compartment, StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration, type DecorationSet } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentUnit, bracketMatching, syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap } from '@codemirror/search'
import { python } from '@codemirror/lang-python'
import { tags as t } from '@lezer/highlight'

export type EditorThemeName = 'arcade' | 'dracula' | 'matrix' | 'retro' | 'synthwave' | 'paper'

type Palette = { bg: string; fg: string; gutter: string; sel: string; active: string; caret: string; kw: string; str: string; num: string; com: string; fn: string; op: string; cls: string; dark: boolean }

export const EDITOR_THEMES: Record<EditorThemeName, Palette> = {
  arcade: { bg: '#0f1330', fg: '#e8eaff', gutter: '#5d6699', sel: '#3a3f7a', active: '#161b42', caret: '#39d0d8', kw: '#c792ea', str: '#c3e88d', num: '#f78c6c', com: '#7f88b8', fn: '#82aaff', op: '#89ddff', cls: '#ffcb6b', dark: true },
  dracula: { bg: '#282a36', fg: '#f8f8f2', gutter: '#6272a4', sel: '#44475a', active: '#323444', caret: '#f8f8f0', kw: '#ff79c6', str: '#f1fa8c', num: '#bd93f9', com: '#6272a4', fn: '#50fa7b', op: '#ff79c6', cls: '#8be9fd', dark: true },
  matrix: { bg: '#020a04', fg: '#4af626', gutter: '#1f6b14', sel: '#0d3b0a', active: '#06170a', caret: '#7dff5c', kw: '#b6ff9e', str: '#2fd11a', num: '#d4ffbf', com: '#1f6b14', fn: '#8cff6e', op: '#4af626', cls: '#d4ffbf', dark: true },
  retro: { bg: '#1a1206', fg: '#ffb000', gutter: '#7a5400', sel: '#3d2a05', active: '#251908', caret: '#ffcc55', kw: '#ffd27a', str: '#ff9d00', num: '#ffe2a6', com: '#8a6410', fn: '#ffc640', op: '#ffb000', cls: '#ffe2a6', dark: true },
  synthwave: { bg: '#241b2f', fg: '#f8f8ff', gutter: '#7c6c96', sel: '#463465', active: '#2d2140', caret: '#ff7edb', kw: '#fede5d', str: '#ff8b39', num: '#f97e72', com: '#848bbd', fn: '#36f9f6', op: '#ff7edb', cls: '#fe4450', dark: true },
  paper: { bg: '#ffffff', fg: '#1d2140', gutter: '#9aa0c2', sel: '#d9dcf7', active: '#f3f4fc', caret: '#5b4ce0', kw: '#7c3aed', str: '#15803d', num: '#c2410c', com: '#6b7280', fn: '#1d4ed8', op: '#0e7490', cls: '#a16207', dark: false },
}

function themeExtension(name: EditorThemeName): Extension {
  const p = EDITOR_THEMES[name] ?? EDITOR_THEMES.arcade
  const theme = EditorView.theme(
    {
      '&': { color: p.fg, backgroundColor: p.bg, borderRadius: '12px' },
      '.cm-content': { caretColor: p.caret, padding: '10px 0' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.caret, borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: p.sel + ' !important' },
      '.cm-gutters': { backgroundColor: p.bg, color: p.gutter, border: 'none', borderRadius: '12px 0 0 12px' },
      '.cm-activeLine': { backgroundColor: p.active },
      '.cm-activeLineGutter': { backgroundColor: p.active, color: p.fg },
      '.cm-matchingBracket': { outline: `1px solid ${p.caret}`, backgroundColor: 'transparent' },
    },
    { dark: p.dark },
  )
  const style = HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: p.kw },
    { tag: [t.string, t.special(t.string)], color: p.str },
    { tag: [t.number, t.bool, t.null], color: p.num },
    { tag: t.comment, color: p.com, fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.definition(t.variableName)), t.definition(t.variableName)], color: p.fn },
    { tag: [t.operator, t.punctuation], color: p.op },
    { tag: [t.className, t.definition(t.className), t.self], color: p.cls },
    { tag: t.propertyName, color: p.fn },
  ])
  return [theme, syntaxHighlighting(style)]
}

const setErrorLine = StateEffect.define<number | null>()
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) deco = Decoration.none
        else deco = Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(e.value).from)])
      }
    }
    if (tr.docChanged) deco = Decoration.none
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

type Props = {
  value: string
  onChange?: (code: string) => void
  onRun?: () => void
  readOnly?: boolean
  errorLine?: number | null
  theme?: EditorThemeName
  fontSize?: number
  minHeight?: number
  ariaLabel?: string
  /** scroll to and select this line (boss: jump to a function) */
  focusLine?: number | null
}

export function CodeEditor({ value, onChange, onRun, readOnly, errorLine, theme = 'arcade', fontSize = 15, minHeight = 220, ariaLabel, focusLine }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const themeComp = useRef(new Compartment())
  const roComp = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  onChangeRef.current = onChange
  onRunRef.current = onRun

  useEffect(() => {
    const runKey = { key: 'Mod-Enter', run: () => (onRunRef.current?.(), true), preventDefault: true }
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        python(),
        keymap.of([runKey, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        themeComp.current.of(themeExtension(theme)),
        roComp.current.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
        errorLineField,
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? 'Éditeur Python', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString())
        }),
      ],
    })
    const v = new EditorView({ state, parent: host.current! })
    view.current = v
    return () => v.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // external value changes (reset, load solution)
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: themeComp.current.reconfigure(themeExtension(theme)) })
  }, [theme])

  useEffect(() => {
    view.current?.dispatch({ effects: roComp.current.reconfigure([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]) })
  }, [readOnly])

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine ?? null) })
  }, [errorLine])

  useEffect(() => {
    const v = view.current
    if (!v || !focusLine || focusLine > v.state.doc.lines) return
    const line = v.state.doc.line(focusLine)
    v.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 12 }) })
    v.focus()
  }, [focusLine])

  return <div ref={host} className="h-full overflow-hidden rounded-xl border border-line" style={{ minHeight, ['--editor-font' as string]: `${fontSize}px` }} />
}
