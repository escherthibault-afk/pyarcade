import { useStore, type Profile } from '../store/store'
import { sfx } from './sound'

type Badge = { id: string; emoji: string; fr: string; en: string; desc: string; secret?: boolean; test: (p: Profile) => boolean }

const done = (p: Profile) => Object.values(p.levels).filter((l) => l.completed).length
const three = (p: Profile) => Object.values(p.levels).filter((l) => l.stars === 3).length
const c = (p: Profile, k: string) => p.counters[k] ?? 0
const won = (p: Profile, id: string) => !!p.bosses[id]?.won
const wonAny = (p: Profile, prefix: string) => Object.entries(p.bosses).some(([id, b]) => id.startsWith(prefix) && b.won)

export const BADGES: Badge[] = [
  { id: 'hello', emoji: '👋', fr: 'Hello, World!', en: 'Hello, World!', desc: 'Réussir un premier niveau.', test: (p) => done(p) >= 1 },
  { id: 'ten', emoji: '🔟', fr: 'Échauffement', en: 'Warm-up', desc: 'Réussir 10 niveaux.', test: (p) => done(p) >= 10 },
  { id: 'fifty', emoji: '🏃', fr: 'En route', en: 'On the road', desc: 'Réussir 50 niveaux.', test: (p) => done(p) >= 50 },
  { id: 'hundred', emoji: '💯', fr: 'Centurion', en: 'Centurion', desc: 'Réussir 100 niveaux.', test: (p) => done(p) >= 100 },
  { id: 'twohundred', emoji: '🏔️', fr: 'Sommet', en: 'Summit', desc: 'Réussir 200 niveaux.', test: (p) => done(p) >= 200 },
  { id: 'stars10', emoji: '⭐', fr: 'Étoile montante', en: 'Rising star', desc: '10 niveaux à 3 étoiles.', test: (p) => three(p) >= 10 },
  { id: 'stars50', emoji: '🌟', fr: 'Perfectionniste', en: 'Perfectionist', desc: '50 niveaux à 3 étoiles.', test: (p) => three(p) >= 50 },
  { id: 'stars100', emoji: '✨', fr: 'Constellation', en: 'Constellation', desc: '100 niveaux à 3 étoiles.', test: (p) => three(p) >= 100 },
  { id: 'streak3', emoji: '🔥', fr: 'Ça chauffe', en: 'Heating up', desc: 'Série de 3 jours.', test: (p) => p.streak.best >= 3 },
  { id: 'streak7', emoji: '🔥', fr: 'Une semaine pile', en: 'One full week', desc: 'Série de 7 jours.', test: (p) => p.streak.best >= 7 },
  { id: 'streak30', emoji: '🌋', fr: 'Volcan', en: 'Volcano', desc: 'Série de 30 jours.', test: (p) => p.streak.best >= 30 },
  { id: 'night', emoji: '🦉', fr: 'Noctambule', en: 'Night owl', desc: 'Réussir un niveau entre 23 h et 5 h.', secret: true, test: (p) => c(p, 'night') >= 1 },
  { id: 'golfer', emoji: '⛳', fr: 'Golfeur', en: 'Golfer', desc: 'Un Code Golf sous le par.', test: (p) => c(p, 'golf_par') >= 1 },
  { id: 'bugs5', emoji: '🐛', fr: 'Chasseur de bugs', en: 'Bug hunter', desc: '5 Chasses au bug.', test: (p) => c(p, 'type:bug_hunt') >= 5 },
  { id: 'bugs20', emoji: '🪲', fr: 'Exterminateur', en: 'Exterminator', desc: '20 Chasses au bug.', test: (p) => c(p, 'type:bug_hunt') >= 20 },
  { id: 'parsons10', emoji: '🧱', fr: 'Maçon', en: 'Bricklayer', desc: '10 puzzles de Parsons.', test: (p) => c(p, 'type:parsons') >= 10 },
  { id: 'oracle', emoji: '🔮', fr: 'Oracle', en: 'Oracle', desc: '10 « Devine la sortie ».', test: (p) => c(p, 'type:predict_output') >= 10 },
  { id: 'speed', emoji: '⚡', fr: 'Lecture rapide', en: 'Speed reader', desc: 'Un Speed Read à 3 étoiles.', test: (p) => c(p, 'speed3') >= 1 },
  { id: 'combo5', emoji: '🎯', fr: 'Combo ×5', en: 'Combo ×5', desc: '5 bonnes réponses d’affilée en QCM éclair.', test: (p) => c(p, 'max_combo') >= 5 },
  { id: 'combo10', emoji: '🎰', fr: 'Combo ×10', en: 'Combo ×10', desc: '10 bonnes réponses d’affilée.', test: (p) => c(p, 'max_combo') >= 10 },
  { id: 'tracer', emoji: '🕵️', fr: 'Détective', en: 'Detective', desc: '5 « Trace-moi ça ».', test: (p) => c(p, 'type:trace') >= 5 },
  { id: 'robot', emoji: '🤖', fr: 'Dresseur de robots', en: 'Robot tamer', desc: '5 niveaux de robot.', test: (p) => c(p, 'type:robot') >= 5 },
  { id: 'tester', emoji: '🧪', fr: 'Testeur', en: 'Tester', desc: '5 « Écris le test ».', test: (p) => c(p, 'type:write_test') >= 5 },
  { id: 'copy3', emoji: '📝', fr: 'Comme au DS', en: 'Like the exam', desc: '3 niveaux en mode copie.', test: (p) => c(p, 'type:copy') >= 3 },
  { id: 'offbyone', emoji: '📏', fr: 'Off-by-one', en: 'Off-by-one', desc: 'Faire 10 fois l’erreur d’indice… puis la corriger.', secret: true, test: (p) => (p.errors.IndexError ?? 0) >= 10 && c(p, 'fixed_after_index') >= 1 },
  { id: 'float', emoji: '🫧', fr: 'Le flottant m’a eu', en: 'Floats got me', desc: 'Tomber dans le piège des flottants.', secret: true, test: (p) => c(p, 'float_trap') >= 1 },
  { id: 'returnsender', emoji: '📮', fr: 'Return to sender', en: 'Return to sender', desc: 'Corriger un print au lieu d’un return.', test: (p) => c(p, 'print_return_fixed') >= 1 },
  { id: 'ouroboros', emoji: '🐍', fr: 'Ouroboros', en: 'Ouroboros', desc: 'Écrire sa première boucle infinie.', secret: true, test: (p) => (p.errors.Timeout ?? 0) >= 1 },
  { id: 'zeropass', emoji: '🛡️', fr: 'Zéro pass', en: 'Zero pass', desc: 'Battre un boss sans perdre de cœur.', test: (p) => Object.values(p.bosses).some((b) => b.won && b.errors === 0) },
  { id: 'boss1', emoji: '👾', fr: 'Premier boss', en: 'First boss', desc: 'Battre un boss.', test: (p) => Object.values(p.bosses).some((b) => b.won) },
  { id: 'boss5', emoji: '🏆', fr: 'Collectionneur de boss', en: 'Boss collector', desc: 'Battre 5 boss.', test: (p) => Object.values(p.bosses).filter((b) => b.won).length >= 5 },
  { id: 'dice', emoji: '🎲', fr: 'Roi des dés', en: 'Dice king', desc: 'Battre le boss 421.', test: (p) => won(p, 'boss-421-guided') },
  { id: 'tennis', emoji: '🎾', fr: 'Monte Carlo', en: 'Monte Carlo', desc: 'Battre le boss Tennis.', test: (p) => won(p, 'boss-tennis-guided') },
  { id: 'recaman', emoji: '♾️', fr: 'Suite logique', en: 'Sequence master', desc: 'Battre le boss Recamán.', test: (p) => won(p, 'boss-recaman-guided') },
  { id: 'boids', emoji: '🐦', fr: 'Chef de nuée', en: 'Flock leader', desc: 'Battre le boss Boids.', test: (p) => won(p, 'boss-boids-guided') },
  { id: 'epidemic', emoji: '🦠', fr: 'Épidémiologiste', en: 'Epidemiologist', desc: 'Battre le boss Épidémie.', test: (p) => won(p, 'boss-epidemic-guided') },
  { id: 'herd', emoji: '💉', fr: 'Herd Immunity', en: 'Herd immunity', desc: 'Trouver le seuil d’immunité collective.', secret: true, test: (p) => c(p, 'herd') >= 1 },
  { id: 'metro', emoji: '🚇', fr: 'Cartographe', en: 'Cartographer', desc: 'Battre le boss Métro.', test: (p) => won(p, 'boss-metro-guided') },
  { id: 'g2048', emoji: '🟧', fr: '2048 avec ton code', en: '2048 with your code', desc: 'Atteindre 2048 avec tes propres fonctions.', test: (p) => c(p, 'reached_2048') >= 1 },
  { id: 'final2048', emoji: '🏗️', fr: 'Architecte', en: 'Architect', desc: 'Battre le boss final 2048.', test: (p) => won(p, 'boss-2048-guided') },
  { id: 'wordle', emoji: '🟩', fr: 'Wordle maison', en: 'Home-made Wordle', desc: 'Battre le boss Wordle.', test: (p) => won(p, 'boss-wordle-guided') },
  { id: 'doubles', emoji: '🔠', fr: 'Maître des doublons', en: 'Double-letter master', desc: 'Réussir 15 cas de lettres en double.', test: (p) => c(p, 'dup_letters') >= 15 },
  { id: 'in2', emoji: '✌️', fr: 'En 2', en: 'In 2', desc: 'Trouver un Wordle en 2 essais avec ton propre code.', secret: true, test: (p) => c(p, 'wordle_in2') >= 1 },
  { id: 'wordleexam', emoji: '🎓', fr: 'Prêt pour l’évaluation', en: 'Exam ready', desc: 'Au moins 14/20 à l’examen Wordle.', test: (p) => p.examsDone.includes('boss-wordle-exam:14') },
  { id: 'twin', emoji: '👯', fr: 'Jumeaux', en: 'Twins', desc: 'Battre un boss jumeau.', test: (p) => wonAny(p, 'boss-') && Object.keys(p.bosses).some((id) => id.includes('-twin-') && p.bosses[id].won) },
  { id: 'rich', emoji: '💰', fr: 'Picsou', en: 'Scrooge', desc: 'Avoir 500 pièces.', test: (p) => p.coins >= 500 },
  { id: 'nohint20', emoji: '🧗', fr: 'Sans filet', en: 'No safety net', desc: '20 niveaux sans indice.', test: (p) => c(p, 'no_hint') >= 20 },
  { id: 'curious', emoji: '💡', fr: 'Curieux', en: 'Curious', desc: 'Acheter 10 indices.', test: (p) => c(p, 'hints') >= 10 },
  { id: 'daily1', emoji: '📅', fr: 'Défi relevé', en: 'Challenge accepted', desc: 'Réussir un défi du jour.', test: (p) => Object.keys(p.daily).length >= 1 },
  { id: 'daily7', emoji: '🗓️', fr: 'Abonné', en: 'Regular', desc: '7 défis du jour.', test: (p) => Object.keys(p.daily).length >= 7 },
  { id: 'review5', emoji: '🐘', fr: 'Mémoire d’éléphant', en: 'Elephant memory', desc: 'Faire 5 révisions.', test: (p) => c(p, 'reviews_done') >= 5 },
  { id: 'chest', emoji: '🧰', fr: 'Chasseur de trésor', en: 'Treasure hunter', desc: 'Ouvrir un coffre mystère.', test: (p) => Object.keys(p.chests).length >= 1 },
  { id: 'sandbox', emoji: '🏖️', fr: 'Bac à sable', en: 'Sandbox', desc: 'Lancer du code dans le bac à sable.', test: (p) => c(p, 'sandbox') >= 1 },
  { id: 'mock', emoji: '🧾', fr: 'Sujet blanc', en: 'Mock exam', desc: 'Terminer un sujet blanc.', test: (p) => c(p, 'mock_done') >= 1 },
  { id: 'diploma', emoji: '🎓', fr: 'Diplôme PyArcade', en: 'PyArcade diploma', desc: 'Réussir l’examen final.', test: (p) => !!p.diploma },
  { id: 'secret', emoji: '🌌', fr: 'Explorateur', en: 'Explorer', desc: 'Entrer dans le monde secret.', secret: true, test: (p) => p.secret && c(p, 'type:code_fill') >= 0 && Object.keys(p.levels).some((id) => id.startsWith('ws-')) },
  { id: 'marathon', emoji: '🏃‍♀️', fr: 'Marathon', en: 'Marathon', desc: '2 h de jeu au total.', test: (p) => p.timeSpentMs >= 2 * 3600 * 1000 },
  { id: 'comeback', emoji: '🧊', fr: 'Gel de série', en: 'Streak freeze', desc: 'Gagner un gel de série.', test: (p) => p.streak.freezes >= 1 || !!p.streak.freezeWeek },
]

/** Checks every badge, stores the new ones and shows a toast for each. */
export function awardBadges() {
  const st = useStore.getState()
  const p = st.profile()
  const fresh = BADGES.filter((b) => !p.badges[b.id] && b.test(p))
  if (!fresh.length) return []
  st.update((q) => {
    for (const b of fresh) q.badges[b.id] = new Date().toISOString()
  })
  fresh.forEach((b, i) =>
    setTimeout(() => {
      st.toast('badge', b.fr, b.emoji)
      sfx.coin()
    }, 600 + i * 700),
  )
  return fresh
}
