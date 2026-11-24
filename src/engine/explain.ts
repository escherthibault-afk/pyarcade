/**
 * Traceback translator: turns Python errors and test failures into short explanations
 * (French by default, English with the language toggle).
 */
import type { PyError, TestResult, Violation } from './api'

type Lang = 'fr' | 'en'
export type Explanation = { title: string; body: string }

const L = (lang: Lang, fr: string, en: string) => (lang === 'en' ? en : fr)

export function explainError(err: PyError, lang: Lang = 'fr'): Explanation {
  const m = err.message ?? ''
  const d = err.detail ?? {}
  const where = err.line ? L(lang, ` (ligne ${err.line})`, ` (line ${err.line})`) : ''
  const T = (fr: string, en: string) => L(lang, fr, en)

  switch (err.type) {
    case 'Timeout':
      return {
        title: T('⏳ Ta boucle ne s’arrête jamais', '⏳ Your loop never stops'),
        body: T(
          'Ta boucle ne s’arrête jamais : vérifie la condition de ton `while` (la variable testée change-t-elle à chaque tour ?). Le programme a été arrêté et Python relancé.',
          'Your loop never stops: check your `while` condition (does the tested variable change on every lap?). The program was stopped and Python restarted.',
        ),
      }
    case 'TopLevelInput':
      return {
        title: T('⌨️ input() en dehors d’une fonction', '⌨️ input() outside a function'),
        body: T(
          'Ton code appelle `input()` (ou `readkey()`) dès son chargement. Pour les tests, mets le code interactif dans une fonction (`game_loop()`), ou protège-le avec `if __name__ == "__main__":`.',
          'Your code calls `input()` (or `readkey()`) as soon as it loads. Put interactive code inside a function (`game_loop()`) or under `if __name__ == "__main__":`.',
        ),
      }
    case 'IndentationError':
    case 'TabError':
      return {
        title: T(`📐 Problème d’indentation${where}`, `📐 Indentation problem${where}`),
        body: /expected an indented block/.test(m)
          ? T(
              'Après une ligne qui finit par `:` (if, for, while, def…), le bloc suivant doit être décalé de 4 espaces.',
              'After a line ending with `:` (if, for, while, def…), the next block must be indented by 4 spaces.',
            )
          : /unindent does not match|unexpected indent/.test(m)
            ? T(
                'Cette ligne n’est pas alignée avec les autres lignes de son bloc. En Python, toutes les lignes d’un même bloc ont exactement le même décalage (multiple de 4 espaces).',
                'This line is not aligned with the other lines of its block. In Python every line of a block has exactly the same indentation (multiple of 4 spaces).',
              )
            : T('Mélange d’espaces et de tabulations, ou décalage incorrect. Utilise 4 espaces par niveau.', 'Mixed tabs and spaces, or wrong indentation. Use 4 spaces per level.'),
      }
    case 'SyntaxError': {
      let body = T('Python n’arrive pas à lire cette ligne. Vérifie les `:`, les parenthèses et les guillemets.', 'Python cannot read this line. Check colons, parentheses and quotes.')
      if (/Maybe you meant '==' or ':='|cannot assign to/.test(m) || /=/.test(err.line_text) && /^\s*(if|elif|while)\b/.test(err.line_text) && !/==|<=|>=|!=/.test(err.line_text))
        body = T('Dans une condition, on compare avec `==` (deux signes égal). Un seul `=` sert à affecter une variable.', 'In a condition, compare with `==` (two equal signs). A single `=` assigns a variable.')
      else if (/expected ':'/.test(m)) body = T('Il manque les deux-points `:` à la fin de la ligne (après `if`, `for`, `while`, `def`, `else`…).', 'A colon `:` is missing at the end of the line (after `if`, `for`, `while`, `def`, `else`…).')
      else if (/was never closed|unmatched|closing parenthesis/.test(m)) body = T('Une parenthèse, un crochet ou une accolade n’est pas refermé(e) (ou l’est en trop).', 'A parenthesis, bracket or brace is not closed (or closed once too often).')
      else if (/unterminated string|EOL while scanning/.test(m)) body = T('Un texte (chaîne) n’est pas refermé : il manque un guillemet.', 'A string is not closed: a quote is missing.')
      else if (/invalid character/.test(m)) body = T('Un caractère invalide s’est glissé (guillemets typographiques “ ” ou ’ copiés d’un document ?). Utilise " ou \'.', 'An invalid character slipped in (curly quotes copied from a document?). Use " or \'.')
      else if (/'return' outside function/.test(m)) body = T('`return` n’a de sens que dans une fonction : vérifie l’indentation.', '`return` only makes sense inside a function: check the indentation.')
      else if (/f-string/.test(m)) body = T('Erreur dans une f-string : les expressions vont entre `{}` et les guillemets intérieurs doivent différer des extérieurs.', 'Error in an f-string: expressions go inside `{}` and inner quotes must differ from outer ones.')
      return { title: T(`✏️ Erreur de syntaxe${where}`, `✏️ Syntax error${where}`), body }
    }
    case 'IndexError': {
      if (typeof d.index === 'number' && typeof d.length === 'number') {
        const n = d.length as number
        const i = d.index as number
        const what = d.container === 'str' ? T('d’une chaîne', 'of a string') : T('d’une liste', 'of a list')
        return {
          title: T(`📏 Case hors de la liste${where}`, `📏 Index out of range${where}`),
          body:
            n === 0
              ? T(`Tu as lu \`${d.expr}\` alors que la ${d.container === 'str' ? 'chaîne' : 'liste'} est vide : elle n’a aucune case.`, `You read \`${d.expr}\` but it is empty: there is no item at all.`)
              : T(
                  `Tu as lu la case n° ${i} ${what} qui n’a que ${n} case${n > 1 ? 's' : ''} (indices 0 à ${n - 1}).${i === n ? ' Classique : `range(len(l) + 1)` ou `<=` au lieu de `<`.' : ''}`,
                  `You read index ${i} of a sequence that only has ${n} item${n > 1 ? 's' : ''} (indices 0 to ${n - 1}).${i === n ? ' Classic: `range(len(l) + 1)` or `<=` instead of `<`.' : ''}`,
                ),
        }
      }
      return {
        title: T(`📏 Case hors de la liste${where}`, `📏 Index out of range${where}`),
        body: T('Tu lis une case qui n’existe pas. Une liste de n cases a des indices de 0 à n−1. Que se passe-t-il au dernier tour de boucle ? Et si la liste est vide ?', 'You read an item that does not exist. A list of n items has indices 0 to n−1. What happens on the last lap? And if the list is empty?'),
      }
    }
    case 'KeyError':
      return {
        title: T(`🔑 Clé absente du dictionnaire${where}`, `🔑 Missing dictionary key${where}`),
        body:
          T(`La clé ${m} n’existe pas dans le dictionnaire.`, `The key ${m} is not in the dictionary.`) +
          (Array.isArray(d.keys) && d.keys.length ? T(` Clés présentes : ${(d.keys as string[]).join(', ')}.`, ` Existing keys: ${(d.keys as string[]).join(', ')}.`) : '') +
          T(' Teste avec `if cle in d:` ou utilise `d.get(cle, valeur_par_defaut)`. Attention aux majuscules et aux espaces (`strip`).', ' Test with `if key in d:` or use `d.get(key, default)`. Watch out for case and spaces (`strip`).'),
      }
    case 'NameError': {
      const name = (d.name as string) ?? (m.match(/'(.+?)'/)?.[1] ?? '?')
      const suggestion = m.match(/Did you mean: '(.+?)'/)?.[1]
      return {
        title: T(`❓ Nom inconnu : ${name}${where}`, `❓ Unknown name: ${name}${where}`),
        body:
          T(`Python ne connaît pas \`${name}\`.`, `Python does not know \`${name}\`.`) +
          (suggestion ? T(` Voulais-tu écrire \`${suggestion}\` ?`, ` Did you mean \`${suggestion}\`?`) : '') +
          T(' Causes fréquentes : faute de frappe, variable créée dans une autre fonction (portée), guillemets oubliés autour d’un texte, module pas importé.', ' Usual causes: typo, variable created in another function (scope), missing quotes around a text, module not imported.'),
      }
    }
    case 'UnboundLocalError': {
      const name = m.match(/'(.+?)'/)?.[1] ?? '?'
      return {
        title: T(`📦 Variable locale pas encore remplie : ${name}${where}`, `📦 Local variable not yet assigned: ${name}${where}`),
        body: T(
          `Dans ta fonction, tu affectes \`${name}\` (donc elle est locale), mais tu la lis avant de lui avoir donné une valeur. Initialise-la au début de la fonction, ou passe-la en paramètre au lieu d’utiliser une variable globale.`,
          `Inside your function you assign \`${name}\` (so it is local) but you read it before giving it a value. Initialise it at the start of the function, or pass it as a parameter instead of using a global.`,
        ),
      }
    }
    case 'TypeError': {
      if (/NoneType/.test(m))
        return {
          title: T(`🕳️ Une valeur vaut None${where}`, `🕳️ A value is None${where}`),
          body: T('Une de tes fonctions ne renvoie rien (`return` oublié, ou `print` à la place de `return`) — ou bien tu as écrit `l = l.append(x)` / `l = l.sort()`, qui mettent `None` dans `l`.', 'One of your functions returns nothing (`return` forgotten, or `print` instead of `return`) — or you wrote `l = l.append(x)` / `l = l.sort()`, which store `None` in `l`.'),
        }
      if (/can only concatenate str|must be str, not/.test(m))
        return { title: T(`🔤 Texte + nombre${where}`, `🔤 Text + number${where}`), body: T('Tu colles un texte et un nombre avec `+`. Convertis avec `str(n)`, ou mieux, utilise une f-string : `f"Score : {n}"`.', 'You glue a text and a number with `+`. Convert with `str(n)`, or better, use an f-string: `f"Score: {n}"`.') }
      if (/unsupported operand type\(s\).*'str'|'str' and 'int'|'int' and 'str'/.test(m))
        return { title: T(`🔤 Calcul avec un texte${where}`, `🔤 Arithmetic on a text${where}`), body: T('Tu fais un calcul avec une chaîne. `input()` et la lecture de fichier renvoient toujours du texte : convertis avec `int(...)` ou `float(...)`.', 'You compute with a string. `input()` and file reading always return text: convert with `int(...)` or `float(...)`.') }
      if (/not supported between instances/.test(m))
        return { title: T(`⚖️ Comparaison impossible${where}`, `⚖️ Impossible comparison${where}`), body: T('Tu compares deux valeurs de types différents (ex. un texte et un nombre). Convertis d’abord.', 'You compare values of different types (e.g. a text and a number). Convert first.') }
      if (/missing \d+ required positional argument/.test(m))
        return { title: T(`🧩 Argument manquant${where}`, `🧩 Missing argument${where}`), body: T(`Tu appelles une fonction avec trop peu d’arguments (${m}). Compare avec la signature imposée.`, `You call a function with too few arguments (${m}). Compare with the required signature.`) }
      if (/takes \d+ positional arguments? but \d+ (were|was) given/.test(m))
        return { title: T(`🧩 Trop d’arguments${where}`, `🧩 Too many arguments${where}`), body: T(`Tu appelles une fonction avec trop d’arguments (${m}). Respecte la signature imposée.`, `Too many arguments (${m}). Stick to the required signature.`) }
      if (/does not support item assignment/.test(m))
        return {
          title: T(`🧊 Objet non modifiable${where}`, `🧊 Immutable object${where}`),
          body: /str/.test(m)
            ? T('Les chaînes sont immuables : `mot[0] = "A"` est impossible. Construis une nouvelle chaîne, ou travaille sur `list(mot)`.', 'Strings are immutable: `word[0] = "A"` is impossible. Build a new string, or work on `list(word)`.')
            : T('Les tuples sont immuables : on ne peut pas changer une case. Crée un nouveau tuple, par exemple `(x + dx, y + dy)`.', 'Tuples are immutable: you cannot change an item. Build a new tuple, e.g. `(x + dx, y + dy)`.'),
        }
      if (/object is not iterable/.test(m))
        return { title: T(`🔁 On ne peut pas parcourir ça${where}`, `🔁 Not iterable${where}`), body: T('Tu fais `for x in n` avec un nombre. Pour répéter n fois : `for i in range(n)`.', 'You wrote `for x in n` with a number. To repeat n times: `for i in range(n)`.') }
      if (/object is not subscriptable/.test(m))
        return { title: T(`🔢 Pas de crochets sur ce type${where}`, `🔢 No brackets on this type${where}`), body: T('Tu utilises `x[i]` sur un nombre (ou une fonction). Vérifie ce que contient vraiment ta variable.', 'You use `x[i]` on a number (or a function). Check what your variable really holds.') }
      if (/object is not callable/.test(m))
        return {
          title: T(`📛 Ce n’est pas une fonction${where}`, `📛 Not a function${where}`),
          body: T('Tu appelles avec `()` quelque chose qui n’est pas une fonction. Piège classique : tu as écrasé un nom intégré (`sum = 0`, `max = …`, `list = …`) puis tu appelles `sum(...)`. Renomme ta variable (`total`, `best`…).', 'You call with `()` something that is not a function. Classic trap: you overwrote a built-in name (`sum = 0`, `max = …`, `list = …`) then call `sum(...)`. Rename your variable.'),
        }
      if (/unhashable type/.test(m))
        return { title: T(`🗝️ Clé interdite${where}`, `🗝️ Forbidden key${where}`), body: T('Une liste (ou un dict) ne peut pas servir de clé de dictionnaire ni d’élément de set. Utilise un tuple.', 'A list (or dict) cannot be a dictionary key or set item. Use a tuple.') }
      if (/indices must be integers/.test(m))
        return { title: T(`🔢 Indice non entier${where}`, `🔢 Non-integer index${where}`), body: T('Un indice de liste doit être un entier. Utilise `//` (division entière) au lieu de `/`, ou convertis avec `int(...)`.', 'A list index must be an integer. Use `//` instead of `/`, or convert with `int(...)`.') }
      break
    }
    case 'ValueError':
      if (/invalid literal for int\(\)/.test(m)) {
        const lit = m.match(/: (.*)$/)?.[1] ?? ''
        return {
          title: T(`🔢 int() ne comprend pas ce texte${where}`, `🔢 int() cannot read this text${where}`),
          body: T(
            `int() ne peut pas convertir ${lit}. Pistes : ligne d’en-tête du CSV lue comme une donnée ? \`\\n\` en fin de ligne (fais \`strip()\`) ? nombre à virgule (utilise \`float\`) ? ligne vide à la fin du fichier ?`,
            `int() cannot convert ${lit}. Ideas: CSV header read as data? trailing \`\\n\` (use \`strip()\`)? decimal number (use \`float\`)? empty last line?`,
          ),
        }
      }
      if (/could not convert string to float/.test(m))
        return { title: T(`🔢 float() ne comprend pas ce texte${where}`, `🔢 float() cannot read this text${where}`), body: T(`${m}. En-tête lu comme une donnée ? ligne vide ? séparateur décimal "," au lieu de "." ?`, `${m}. Header read as data? empty line? decimal comma instead of dot?`) }
      if (/too many values to unpack|not enough values to unpack/.test(m))
        return { title: T(`📦 Déballage : mauvais nombre de valeurs${where}`, `📦 Unpacking: wrong number of values${where}`), body: T(`Le nombre de variables à gauche du \`=\` doit être égal au nombre de valeurs à droite (${m}). Pour un CSV : la ligne a-t-elle bien ce nombre de colonnes ?`, `The number of variables left of \`=\` must equal the number of values (${m}).`) }
      if (/empty sequence|empty iterable/.test(m))
        return { title: T(`🫙 Séquence vide${where}`, `🫙 Empty sequence${where}`), body: T('`max()` ou `min()` sur une liste vide : traite le cas vide à part avant.', '`max()` or `min()` on an empty list: handle the empty case first.') }
      if (/not in list/.test(m))
        return { title: T(`🔍 Élément absent${where}`, `🔍 Item not found${where}`), body: T('`.remove(x)` ou `.index(x)` sur un élément absent de la liste. Teste d’abord avec `if x in l:`.', '`.remove(x)` or `.index(x)` on a missing item. Test first with `if x in l:`.') }
      break
    case 'ZeroDivisionError':
      return { title: T(`➗ Division par zéro${where}`, `➗ Division by zero${where}`), body: T('Tu divises par 0. Que se passe-t-il si la liste est vide, ou si le compteur vaut 0 ? Traite ce cas avant la division.', 'You divide by 0. What if the list is empty, or the counter is 0? Handle that case before dividing.') }
    case 'RecursionError':
      return { title: T('🌀 Récursion infinie', '🌀 Infinite recursion'), body: T('Ta fonction s’appelle elle-même sans jamais s’arrêter. Il manque un cas de base, ou l’appel ne se rapproche pas de ce cas.', 'Your function calls itself forever. A base case is missing, or the call does not get closer to it.') }
    case 'AttributeError': {
      if (/NoneType/.test(m))
        return { title: T(`🕳️ None n’a pas cette méthode${where}`, `🕳️ None has no such method${where}`), body: T('Ta variable vaut `None`. Piège classique : `l = l.append(x)` ou `l = l.sort()` (ces méthodes modifient la liste et renvoient None), ou une fonction sans `return`.', 'Your variable is `None`. Classic trap: `l = l.append(x)` or `l = l.sort()` (they modify in place and return None), or a function without `return`.') }
      if (/'str' object has no attribute 'append'/.test(m))
        return { title: T(`🔤 Pas de append sur une chaîne${where}`, `🔤 No append on a string${where}`), body: T('Les chaînes n’ont pas `.append`. Concatène : `s = s + "x"`, ou construis une liste puis `"".join(liste)`.', 'Strings have no `.append`. Concatenate: `s = s + "x"`, or build a list then `"".join(list)`.') }
      if (/'list' object has no attribute '(lower|upper|strip|split)'/.test(m))
        return { title: T(`📚 Méthode de chaîne sur une liste${where}`, `📚 String method on a list${where}`), body: T('Tu appelles une méthode de chaîne sur une liste. Parcours la liste et applique la méthode à chaque élément.', 'You call a string method on a list. Loop over the list and apply it to each item.') }
      return { title: T(`🔧 Méthode inconnue${where}`, `🔧 Unknown attribute${where}`), body: T(`${m}. Vérifie le type de ta variable et l’orthographe de la méthode.`, `${m}. Check the variable type and spelling.`) }
    }
    case 'FileNotFoundError':
      return { title: T(`📁 Fichier introuvable${where}`, `📁 File not found${where}`), body: T(`${m}. Vérifie le nom exact du fichier (majuscules, extension) donné dans l’énoncé.`, `${m}. Check the exact file name from the statement.`) }
    case 'ModuleNotFoundError': {
      const mod = m.match(/'(.+?)'/)?.[1] ?? ''
      const shim: Record<string, string> = { rich: 'rich_lite', readchar: 'readchar_lite', folium: 'folium_lite', pygame: 'canvas' }
      if (shim[mod.split('.')[0]])
        return { title: T(`📦 Module ${mod} absent du site`, `📦 Module ${mod} not on the site`), body: T(`Sur le site, utilise \`${shim[mod.split('.')[0]]}\` (même idée, API simplifiée). Le jour de l’examen, sur ton ordinateur, tu écriras \`${mod}\`.`, `On the site use \`${shim[mod.split('.')[0]]}\`. On your own computer you will write \`${mod}\`.`) }
      if (mod.includes('.')) {
        // `import random.int`: importing a function as if it were a module
        const [pkg, ...rest] = mod.split('.')
        const name = rest.join('.')
        return {
          title: T(`📦 ${mod} n’est pas un module`, `📦 ${mod} is not a module`),
          body: T(
            `\`import\` sert à charger un **module** entier (\`${pkg}\`), pas une fonction. Écris \`import ${pkg}\` puis utilise \`${pkg}.nom_de_la_fonction(...)\`, ou bien \`from ${pkg} import ${name}\`. Vérifie aussi le nom exact de la fonction (pour un entier au hasard : \`random.randint(a, b)\`).`,
            `\`import\` loads a whole **module** (\`${pkg}\`), not a function. Write \`import ${pkg}\` then \`${pkg}.function(...)\`, or \`from ${pkg} import ${name}\`.`,
          ),
        }
      }
      return { title: T(`📦 Module introuvable : ${mod}`, `📦 Module not found: ${mod}`), body: T('Vérifie l’orthographe de l’import. Les modules du cours : `random`, `math`, `csv`, `matplotlib.pyplot`.', 'Check the import spelling.') }
    }
    case 'EOFError':
      return { title: T('⌨️ input() sans entrée', '⌨️ input() without input'), body: T('Ton code demande une saisie (`input`) alors que ce test n’en fournit pas. Une fonction testée doit recevoir ses données en paramètres, pas avec `input()`.', 'Your code asks for input while this test provides none. A tested function should get its data as parameters, not with `input()`.') }
    case 'AssertionError':
      return { title: T(`🚨 assert échoué${where}`, `🚨 assert failed${where}`), body: err.line_text ? `\`${err.line_text.trim()}\`` : m }
    case 'BadTest':
      return { title: T('⚠️ Test mal écrit', '⚠️ Broken test'), body: m }
  }
  return { title: `${err.type}${where}`, body: m }
}

export function explainReason(r: TestResult, lang: Lang = 'fr'): Explanation | null {
  const T = (fr: string, en: string) => L(lang, fr, en)
  switch (r.reason) {
    case 'print_not_return':
      return {
        title: T('🖨️ Tu affiches au lieu de renvoyer', '🖨️ You print instead of returning'),
        body: T('Ta fonction fait `print(...)` mais renvoie `None`. Le test (et le correcteur) attend une valeur renvoyée avec `return`. C’est l’erreur n° 1 des débutants !', 'Your function prints but returns `None`. The test (and the grader) expects a value returned with `return`. Mistake #1 of beginners!'),
      }
    case 'returned_none':
      return { title: T('🕳️ Ta fonction renvoie None', '🕳️ Your function returns None'), body: T('Il manque un `return` (peut-être seulement dans une des branches de ton `if`).', 'A `return` is missing (maybe in only one branch of your `if`).') }
    case 'list_vs_tuple':
      return { title: T('📦 Liste ou tuple ?', '📦 List or tuple?'), body: T(`Les valeurs sont peut-être bonnes, mais pas le type${r.where ? ` (${r.where})` : ''} : la signature demande l’autre (crochets [ ] = liste, parenthèses ( ) = tuple).`, `Values may be right but not the type${r.where ? ` (${r.where})` : ''}: [ ] is a list, ( ) a tuple.`) }
    case 'float_vs_int':
      return { title: T('🔢 float au lieu de int', '🔢 float instead of int'), body: T('Tu renvoies un nombre à virgule (ex. `3.0`) alors qu’on attend un entier (`3`). Utilise `//` (division entière) au lieu de `/`, ou `int(...)`.', 'You return a float (e.g. `3.0`) where an int (`3`) is expected. Use `//` instead of `/`.') }
    case 'mutated_args':
      return { title: T('🧪 Ta fonction modifie ses paramètres', '🧪 Your function mutates its arguments'), body: T('Cette fonction doit être pure : elle ne doit pas modifier la liste / le dict / la grille reçue. Travaille sur une copie (`list(l)`, `[ligne[:] for ligne in grid]`, `dict(d)`) et renvoie le nouveau résultat.', 'This function must be pure: do not modify the received list/dict/grid. Work on a copy and return the new result.') }
    case 'wrong_output':
      return { title: T('🖥️ Affichage différent', '🖥️ Different output'), body: T('Ce qui est affiché ne correspond pas exactement (espaces, majuscules, ponctuation et retours à la ligne comptent).', 'The printed text does not match exactly (spaces, case, punctuation and newlines matter).') }
    case 'timeout':
      return explainError({ type: 'Timeout', message: '', line: null, line_text: '', detail: {}, trace: '' }, lang)
    case 'skipped':
      return { title: T('⏭️ Test non lancé', '⏭️ Test skipped'), body: T('Les tests précédents ne s’arrêtaient pas : corrige d’abord la boucle infinie.', 'Previous tests never stopped: fix the infinite loop first.') }
    case 'length':
      return { title: T('📏 Pas le bon nombre d’éléments', '📏 Wrong number of items'), body: T('Ta liste/ton tuple n’a pas la bonne longueur. Pense aux bornes de `range` (décalage d’une case ?).', 'Your list/tuple has the wrong length. Check `range` bounds (off by one?).') }
    case 'keys':
      return { title: T('🗝️ Clés différentes', '🗝️ Different keys'), body: T('Ton dictionnaire n’a pas exactement les clés attendues (orthographe, majuscules, clé en trop ou manquante).', 'Your dictionary does not have exactly the expected keys.') }
    case 'type':
      return { title: T('🔀 Mauvais type', '🔀 Wrong type'), body: T(`Le type renvoyé${r.where && r.where !== 'résultat' ? ` (${r.where})` : ''} n’est pas celui attendu (ex. texte "3" au lieu du nombre 3, ou 1 au lieu de True).`, 'The returned type is not the expected one (e.g. text "3" instead of number 3).') }
    case 'float':
      return { title: T('🎯 Presque…', '🎯 Almost…'), body: T('Ton nombre à virgule est différent de la valeur attendue.', 'Your float differs from the expected value.') }
    case 'stat':
      return { title: T('🎲 Statistique hors tolérance', '🎲 Statistic out of tolerance'), body: T('Sur un grand nombre de tirages, la fréquence observée est trop loin de la valeur attendue. Vérifie la probabilité utilisée (`random() < p`) et les bornes de `randint` (incluses).', 'Over many draws, the observed frequency is too far from the expected value. Check `random() < p` and `randint` bounds (inclusive).') }
    case 'no_exception':
      return { title: T('🚫 Aucune erreur levée', '🚫 No exception raised'), body: T(`Ce cas devait lever ${r.expected}.`, `This case should raise ${r.expected}.`) }
    case 'wrong_exception':
      return { title: T('🚫 Mauvaise erreur', '🚫 Wrong exception'), body: T(`On attendait ${r.expected}, tu as obtenu ${r.got}.`, `Expected ${r.expected}, got ${r.got}.`) }
  }
  return null
}

const RULE_NAMES: Record<string, [string, string]> = {
  While: ['une boucle `while`', 'a `while` loop'],
  For: ['une boucle `for`', 'a `for` loop'],
  If: ['un `if`', 'an `if`'],
  ClassDef: ['une classe (`class`)', 'a class'],
  ListComp: ['une compréhension de liste', 'a list comprehension'],
  Comprehension: ['une compréhension', 'a comprehension'],
  Return: ['un `return`', 'a `return`'],
  FunctionDef: ['une fonction (`def`)', 'a function (`def`)'],
  Lambda: ['une `lambda`', 'a `lambda`'],
  Global: ['`global`', '`global`'],
  Break: ['`break`', '`break`'],
  Dict: ['un dictionnaire littéral `{...}`', 'a dict literal'],
  Recursion: ['un appel récursif', 'a recursive call'],
  Try: ['un `try`', 'a `try`'],
  With: ['un bloc `with`', 'a `with` block'],
  Mult: ['une multiplication `*`', 'a multiplication `*`'],
  Add: ['une addition `+`', 'an addition `+`'],
  FloorDiv: ['une division entière `//`', 'a floor division `//`'],
  Mod: ['un modulo `%`', 'a modulo `%`'],
  Div: ['une division `/`', 'a division `/`'],
  BoolOp: ['`and` / `or`', '`and` / `or`'],
  JoinedStr: ['une f-string', 'an f-string'],
  Subscript: ['des crochets `[...]`', 'brackets `[...]`'],
  Tuple: ['un tuple', 'a tuple'],
  Set: ['un ensemble `{...}`', 'a set'],
}

function ruleName(rule: string, lang: Lang) {
  if (RULE_NAMES[rule]) return RULE_NAMES[rule][lang === 'en' ? 1 : 0]
  if (rule.startsWith('call:')) return L(lang, `un appel à \`${rule.slice(5)}\``, `a call to \`${rule.slice(5)}\``)
  if (rule.startsWith('method:')) return L(lang, `la méthode \`.${rule.slice(7)}()\``, `the method \`.${rule.slice(7)}()\``)
  if (rule.startsWith('import:')) return L(lang, `l’import de \`${rule.slice(7)}\``, `importing \`${rule.slice(7)}\``)
  if (rule.startsWith('name:')) return L(lang, `la variable \`${rule.slice(5)}\``, `the variable \`${rule.slice(5)}\``)
  return `\`${rule}\``
}

export function explainViolation(v: Violation, lang: Lang = 'fr'): string {
  switch (v.rule) {
    case 'required':
      return L(lang, `Ton code doit utiliser ${ruleName(v.detail!, lang)}.`, `Your code must use ${ruleName(v.detail!, lang)}.`)
    case 'forbidden':
      return L(lang, `Interdit ici : ${ruleName(v.detail!, lang)}.`, `Not allowed here: ${ruleName(v.detail!, lang)}.`)
    case 'max_count':
      return L(lang, `Au plus ${v.limit} × ${ruleName(v.detail!, lang)} (tu en as ${v.count}).`, `At most ${v.limit} × ${ruleName(v.detail!, lang)} (you have ${v.count}).`)
    case 'max_lines':
      return L(lang, `Au plus ${v.limit} lignes de code (tu en as ${v.count}).`, `At most ${v.limit} lines (you have ${v.count}).`)
    case 'max_chars':
      return L(lang, `Au plus ${v.limit} caractères (tu en as ${v.count}).`, `At most ${v.limit} characters (you have ${v.count}).`)
    case 'missing_function':
      return L(lang, `La fonction \`${v.detail}\` est introuvable : garde exactement la signature imposée.`, `Function \`${v.detail}\` not found: keep the exact signature.`)
  }
  return v.rule
}
