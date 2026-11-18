import { useStore } from '../store/store'

/** Bilingual inline strings: tr('Lancer', 'Run'). French is the reference language. */
export function useTr() {
  const lang = useStore((s) => s.settings.lang)
  return (fr: string, en?: string) => (lang === 'en' && en ? en : fr)
}

export function useLang() {
  return useStore((s) => s.settings.lang)
}
