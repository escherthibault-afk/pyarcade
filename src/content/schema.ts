/**
 * PyArcade content schema (zod).
 *
 * Every level lives in `content/<world>/<id>.yaml` and is validated by `LevelSchema`.
 * The same schema is used by the app (runtime defaults) and by `npm run verify-content`.
 * Adding a level never requires code: drop a YAML file, run `npm run verify-content`.
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

export const LEVEL_TYPES = [
  'lesson', // mini-leçon interactive (< 2 min) : exemple commenté modifiable
  'code_fill', // remplacer `pass` (format examen)
  'predict_output', // devine la sortie / Speed Read (timed_seconds)
  'bug_hunt', // chasse au bug
  'parsons', // puzzle de Parsons (ordre + indentation)
  'trace', // trace-moi ça (tableau des variables)
  'truth_table', // écrire LA condition booléenne
  'robot', // robot de grille
  'write_test', // écris les assert qui éliminent les fausses implémentations
  'golf', // code golf
  'big_volume', // course contre la montre / gros volume
  'refactor', // remplacer une cascade de if par une table / formule
  'assemble', // brancher des fonctions données dans le bon ordre
  'quiz', // QCM éclair
  'simulation', // simulation à régler (curseurs + question d'observation)
  'copy', // mode copie : sans exécution, une seule soumission
  'color_tiles', // Wordle : « Devine la couleur »
  'boss', // boss = TP complet (guidé / jumeau / examen)
] as const
export type LevelType = (typeof LEVEL_TYPES)[number]

/** A world id is a number (0..12) or a special path: "wordle", "secret". */
export const WorldId = z.union([z.number().int().min(0).max(20), z.enum(['wordle', 'secret', 'bonus'])])
export type WorldId = z.infer<typeof WorldId>

/** One test. Exactly one of `call` or `script` drives it. */
export const TestCase = z
  .object({
    /** Python expression evaluated in the student's namespace, e.g. `countdown(3)`. */
    call: z.string().optional(),
    /** Python expression for the expected value (evaluated in a clean namespace). */
    expected: z.string().optional(),
    /** Expected stdout (exact, trailing spaces on each line ignored). */
    output: z.string().optional(),
    /** Lines fed to `input()`. */
    stdin: z.array(z.string()).optional(),
    /** Run the whole program (top-level code) instead of a call. */
    script: z.boolean().optional(),
    /** Name of the exception that must be raised, e.g. `ValueError`. */
    raises: z.string().optional(),
    /** The function must not mutate its arguments (deep copy before/after). */
    pure: z.boolean().optional(),
    /** Python code run in the namespace before `call` (may define test data). */
    setup: z.string().optional(),
    /** Absolute/relative tolerance for floats (default 1e-9). */
    tol: z.number().optional(),
    /** Short human label, e.g. "lettres en double dans le secret". */
    label: z.string().optional(),
    /** Function this test belongs to (bosses: one group per function). */
    fn: z.string().optional(),
    /** Per-test timeout override (ms). */
    timeout_ms: z.number().int().positive().optional(),
  })
  .refine((t) => !!t.call || !!t.script, { message: 'a test needs `call` or `script: true`' })
  .refine((t) => t.expected !== undefined || t.output !== undefined || t.raises !== undefined || t.pure, {
    message: 'a test needs `expected`, `output`, `raises` or `pure`',
  })
export type TestCase = z.infer<typeof TestCase>

export const StatTest = z.object({
  expr: z.string(),
  approx: z.number(),
  tol: z.number().positive(),
  label: z.string().optional(),
  fn: z.string().optional(),
})
export type StatTest = z.infer<typeof StatTest>

export const Tests = z.object({
  visible: z.array(TestCase).default([]),
  hidden: z.array(TestCase).default([]),
  random_seed: z.number().int().optional(),
  statistical: z.array(StatTest).default([]),
})
export type Tests = z.infer<typeof Tests>

/**
 * Constraints checked with Python's `ast`.
 * Items are AST node names (`While`, `For`, `ListComp`, `ClassDef`, `If`…) or
 * `call:<name>` (function or method call), `method:<name>`, `import:<module>`, `name:<identifier>`.
 */
export const Constraints = z.object({
  required: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
  max_lines: z.number().int().positive().optional(),
  max_chars: z.number().int().positive().optional(),
  max_count: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Restrict the check to this function's body (bosses). */
  scope: z.string().optional(),
})
export type Constraints = z.infer<typeof Constraints>

/** A concept card saved in the Carnet after success. */
export const Card = z.object({ title: z.string(), body_md: z.string() })

const Base = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  world: WorldId,
  title: z.string(),
  concepts: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5).default(1),
  estimated_minutes: z.number().positive().default(3),
  xp: z.number().int().min(0).default(20),
  story: z.string().default(''),
  statement_md: z.string().default(''),
  hints: z.array(z.string()).max(3).default([]),
  explanation_md: z.string().default(''),
  exam_tip: z.string().default(''),
  card: Card.optional(),
  /** Sort key inside the world (falls back to the id). */
  order: z.number().optional(),
  /** Virtual files available to the program. Value = inline text, or `@data/<file>` for /content/data. */
  files: z.record(z.string(), z.string()).default({}),
  /** Marks an interleaving level that revisits older concepts. */
  review: z.boolean().default(false),
  /** Optional English overrides for the UI language toggle. */
  title_en: z.string().optional(),
})

const CodeFields = {
  starter_code: z.string(),
  solution: z.string(),
  tests: Tests,
  constraints: Constraints.default({ required: [], forbidden: [] }),
  /** Code executed before the student's code (helpers given by the statement, shown read-only). */
  given_code: z.string().default(''),
  /** Python packages to preload in Pyodide (e.g. matplotlib). */
  packages: z.array(z.string()).default([]),
}

export const CodeLevel = Base.extend({
  type: z.enum(['code_fill', 'bug_hunt', 'golf', 'big_volume', 'refactor', 'assemble', 'copy']),
  ...CodeFields,
  /** bug_hunt: number of bugs = number of lives. */
  bugs: z.number().int().positive().optional(),
  /** golf: 3rd star when the code is at most this many characters. */
  par_chars: z.number().int().positive().optional(),
  /** big_volume: per-test time limit in the browser (ms). */
  time_limit_ms: z.number().int().positive().optional(),
})

export const LessonLevel = Base.extend({
  type: z.literal('lesson'),
  /** The commented, editable example. */
  example_code: z.string(),
  /** What to change ("change ce 3 en 10 et relance"). */
  task_md: z.string().default(''),
  /** If set, the run must print exactly this. Otherwise any successful run validates. */
  expected_output: z.string().optional(),
  /** A version of the example that produces expected_output (checked by verify-content). */
  solution: z.string().optional(),
  stdin: z.array(z.string()).default([]),
  packages: z.array(z.string()).default([]),
})

export const PredictLevel = Base.extend({
  type: z.literal('predict_output'),
  code: z.string(),
  /** Expected stdout. verify-content checks it against a real run. */
  answer: z.string(),
  stdin: z.array(z.string()).default([]),
  /** Speed Read: time limit in seconds (ghost bar shows your best time). */
  timed_seconds: z.number().int().positive().optional(),
})

export const ParsonsLevel = Base.extend({
  type: z.literal('parsons'),
  /** Correct program, one entry per line, indentation with 4 spaces. */
  lines: z.array(z.string()).min(2),
  /** Decoy lines that must NOT be used. */
  distractors: z.array(z.string()).default([]),
  /** If tests are given, any arrangement that passes them is accepted. */
  tests: Tests.optional(),
})

export const QuizQuestion = z.object({
  q: z.string(),
  code: z.string().optional(),
  choices: z.array(z.string()).min(2).max(6),
  answer: z.number().int().min(0),
  explain: z.string().optional(),
})
export const QuizLevel = Base.extend({
  type: z.literal('quiz'),
  questions: z.array(QuizQuestion).min(3),
  time_limit: z.number().int().positive().default(60),
})

export const TraceLevel = Base.extend({
  type: z.literal('trace'),
  /** Code with exactly one line tagged `# @snap`: a row is recorded each time that line has run. */
  code: z.string(),
  watch: z.array(z.string()).min(1),
  max_rows: z.number().int().positive().default(12),
})

export const TruthTableLevel = Base.extend({
  type: z.literal('truth_table'),
  vars: z.array(z.string()).min(1).max(4),
  /** Rows of input values. If omitted: every True/False combination. */
  rows: z.array(z.record(z.string(), z.union([z.boolean(), z.number(), z.string()]))).optional(),
  /** Reference expression: defines the expected column. */
  solution: z.string(),
  /** Bonus star when the expression has at most this many characters (spaces ignored). */
  simple_len: z.number().int().positive().optional(),
})

export const RobotLevel = Base.extend({
  type: z.literal('robot'),
  /** One or more maps. `#` wall, `.` floor, `G` goal, `*` coin, robot start: `^ > v <`. */
  grids: z.array(z.array(z.string()).min(1)).min(1),
  starter_code: z.string(),
  solution: z.string(),
  constraints: Constraints.default({ required: [], forbidden: [] }),
  max_steps: z.number().int().positive().default(500),
})

export const WriteTestLevel = Base.extend({
  type: z.literal('write_test'),
  /** Signature + docstring of the function under test (shown to the student). */
  signature: z.string(),
  implementations: z
    .array(z.object({ label: z.string(), code: z.string(), correct: z.boolean() }))
    .min(2),
  starter_code: z.string(),
  /** Reference asserts: must pass on the correct impl and kill every wrong one. */
  solution: z.string(),
})

export const ColorTilesLevel = Base.extend({
  type: z.literal('color_tiles'),
  rounds: z.array(z.object({ secret: z.string(), guess: z.string(), note: z.string().optional() })).min(1),
})

export const SimParam = z.object({
  name: z.string(),
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  default: z.number(),
})
export const SimulationLevel = Base.extend({
  type: z.literal('simulation'),
  ...CodeFields,
  /** Python expression evaluated once the tests pass, with the slider values as variables. Returns draw data. */
  sim: z.object({
    kind: z.enum(['grid', 'boids', 'curve', 'canvas']),
    params: z.array(SimParam).default([]),
    /** Python code using the student's functions + params; must define `frames` (list) or `curve` (list of numbers). */
    driver: z.string(),
    question: QuizQuestion.optional(),
  }),
})

export const BossStep = z.object({
  fn: z.string(),
  title: z.string(),
  statement_md: z.string().default(''),
  starter_code: z.string(),
  solution: z.string(),
  tests: Tests,
  hints: z.array(z.string()).max(3).default([]),
  constraints: Constraints.optional(),
  /** Exam rubric: points for this function (total should be 20). */
  points: z.number().min(0).default(1),
})
export type BossStep = z.infer<typeof BossStep>

export const BossLevel = Base.extend({
  type: z.literal('boss'),
  variant: z.enum(['guided', 'twin', 'exam']),
  /** Reference project: wordle, mastermind, dice421, tennis, ... */
  project: z.string(),
  /** Imports / constants written at the top of the file. */
  header_code: z.string().default(''),
  steps: z.array(BossStep).min(3),
  /** React live game powered by the student's functions. */
  live_game: z.string().optional(),
  /** Exam: duration in minutes. */
  time_limit_minutes: z.number().int().positive().optional(),
  /** Stars needed in the world to unlock this boss. */
  min_stars: z.number().int().min(0).default(0),
  hp: z.number().int().positive().default(100),
  packages: z.array(z.string()).default([]),
  /** Exam replay variants: `{{NAME}}` placeholders replaced everywhere in the level. */
  variants: z.array(z.object({ label: z.string(), vars: z.record(z.string(), z.union([z.string(), z.number()])) })).default([]),
  /** Long statement shown before the functions (context, rules, tables). */
  intro_md: z.string().default(''),
})

export const LevelSchema = z.discriminatedUnion('type', [
  CodeLevel,
  LessonLevel,
  PredictLevel,
  ParsonsLevel,
  QuizLevel,
  TraceLevel,
  TruthTableLevel,
  RobotLevel,
  WriteTestLevel,
  ColorTilesLevel,
  SimulationLevel,
  BossLevel,
])
export type Level = z.infer<typeof LevelSchema>
export type CodeLevel = z.infer<typeof CodeLevel>
export type LessonLevel = z.infer<typeof LessonLevel>
export type PredictLevel = z.infer<typeof PredictLevel>
export type ParsonsLevel = z.infer<typeof ParsonsLevel>
export type QuizLevel = z.infer<typeof QuizLevel>
export type TraceLevel = z.infer<typeof TraceLevel>
export type TruthTableLevel = z.infer<typeof TruthTableLevel>
export type RobotLevel = z.infer<typeof RobotLevel>
export type WriteTestLevel = z.infer<typeof WriteTestLevel>
export type ColorTilesLevel = z.infer<typeof ColorTilesLevel>
export type SimulationLevel = z.infer<typeof SimulationLevel>
export type BossLevel = z.infer<typeof BossLevel>

/** Levels whose main interaction is a code editor + tests. */
export type EditorLevel = CodeLevel | SimulationLevel

/* ------------------------------------------------------------------ */
/* World metadata: content/worlds.yaml                                  */
/* ------------------------------------------------------------------ */

export const WorldMeta = z.object({
  id: WorldId,
  title: z.string(),
  title_en: z.string().optional(),
  subtitle: z.string().default(''),
  emoji: z.string().default('🕹️'),
  color: z.string().default('#8b7cff'),
  /** Boss ids shown at the end of the world, in order. */
  bosses: z.array(z.string()).default([]),
  /** Concepts trained in this world (for the mastery radar). */
  radar: z.string().optional(),
  /** Hidden until unlocked by something else (secret world). */
  secret: z.boolean().default(false),
})
export type WorldMeta = z.infer<typeof WorldMeta>

export const WorldsFile = z.object({ worlds: z.array(WorldMeta) })
