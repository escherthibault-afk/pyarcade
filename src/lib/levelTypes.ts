import type { LevelType } from '../content/schema'

export const TYPE_META: Record<LevelType, { icon: string; fr: string; en: string; editor: boolean }> = {
  lesson: { icon: '📖', fr: 'Mini-leçon', en: 'Mini lesson', editor: true },
  code_fill: { icon: '✍️', fr: 'Code Fill', en: 'Code Fill', editor: true },
  predict_output: { icon: '🔮', fr: 'Devine la sortie', en: 'Predict the output', editor: false },
  bug_hunt: { icon: '🐛', fr: 'Chasse au bug', en: 'Bug hunt', editor: true },
  parsons: { icon: '🧱', fr: 'Puzzle de Parsons', en: 'Parsons puzzle', editor: false },
  trace: { icon: '🕵️', fr: 'Trace-moi ça', en: 'Trace it', editor: false },
  truth_table: { icon: '🚦', fr: 'Table de vérité', en: 'Truth table', editor: false },
  robot: { icon: '🤖', fr: 'Robot de grille', en: 'Grid robot', editor: true },
  write_test: { icon: '🧪', fr: 'Écris le test', en: 'Write the test', editor: true },
  golf: { icon: '⛳', fr: 'Code Golf', en: 'Code golf', editor: true },
  big_volume: { icon: '🏎️', fr: 'Gros volume', en: 'Big input', editor: true },
  refactor: { icon: '♻️', fr: 'Refactor', en: 'Refactor', editor: true },
  assemble: { icon: '🔧', fr: 'Assemble la machine', en: 'Assemble the machine', editor: true },
  quiz: { icon: '⚡', fr: 'QCM éclair', en: 'Flash quiz', editor: false },
  simulation: { icon: '🎛️', fr: 'Simulation à régler', en: 'Tune the simulation', editor: true },
  copy: { icon: '📝', fr: 'Mode copie', en: 'Paper mode', editor: true },
  color_tiles: { icon: '🟩', fr: 'Devine la couleur', en: 'Guess the colours', editor: false },
  boss: { icon: '👾', fr: 'Boss', en: 'Boss', editor: true },
}
