// ---------------------------------------------------------------------------
// Normalisation textuelle pour une recherche tolérante aux accents/casse.
// "Dupont", "dupont", "DuPont" → "dupont". "Édith" → "edith".
// ---------------------------------------------------------------------------

const ACCENTS: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y', ç: 'c', ñ: 'n', æ: 'ae', œ: 'oe', ß: 'ss',
}

/** Minuscule, sans accents, espaces compressés. */
export function normalizeText(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    out += ACCENTS[ch] ?? ch
  }
  return out.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Pour le tri / recherche : "Jean Dupont" → "dupont jean". */
export function personSortName(givenName: string, surname: string): string {
  const g = normalizeText(givenName)
  const s = normalizeText(surname)
  return [s, g].filter(Boolean).join(' ').toUpperCase()
}

/** Texte complet normalisé (recherche JSON). */
export function personSearchText(p: {
  given_name: string
  surname: string
  birth_name: string
  profession: string
  notes: string
}): string {
  return normalizeText(
    [p.given_name, p.surname, p.birth_name, p.profession, p.notes].join(' '),
  )
}

/** Correspondance approximative (Levenshtein) — pour la recherche fuzzy.
 *  Accepté si la distance est <= maxDistance (sur les formes courtes). */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}