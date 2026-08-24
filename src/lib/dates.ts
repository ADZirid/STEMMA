// ---------------------------------------------------------------------------
// Dates flexibles : exacte, vers, avant, après, entre, inconnue.
// ---------------------------------------------------------------------------
import type { DateQualifier, DateValue } from '@/types'

export interface DateInput {
  qualifier: DateQualifier
  d1: string
  d2: string
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback aléatoire local (aucun réseau).
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Relève l'année (ou partie d'année) pour le tri. */
function extractYear(s: string): number | null {
  const m = s.match(/\d{3,4}/)
  if (!m) return null
  let y = parseInt(m[0], 10)
  if (y < 100) {
    // Date au format JJ/MM/AA : hypothèse raisonnable.
    y += y < 40 ? 2000 : 1900
  }
  return Number.isFinite(y) ? y : null
}

/** Construit la valeur de date normalisée à partir d'une saisie libre. */
export function buildDateValue(input: DateInput): DateValue {
  const d1 = input.d1.trim()
  const d2 = input.d2.trim()
  let sort_key = extractYear(d1)
  if (input.qualifier === 'between' && d2) {
    const y2 = extractYear(d2)
    sort_key = sort_key === null ? y2 : y2 === null ? sort_key : Math.floor((sort_key + y2) / 2)
  }
  const label = dateLabel(input)
  return {
    id: uid(),
    qualifier: input.qualifier,
    d1,
    d2,
    sort_key,
    label,
  }
}

/** Libellé lisible ("vers 1920", "entre 1910 et 1920", …). */
export function dateLabel(input: { qualifier: DateQualifier; d1: string; d2: string }): string {
  const { qualifier, d1, d2 } = input
  switch (qualifier) {
    case 'about': return d1 ? `vers ${d1}` : 'vers ?'
    case 'before': return d1 ? `avant ${d1}` : 'avant ?'
    case 'after': return d1 ? `après ${d1}` : 'après ?'
    case 'between': return `entre ${d1} et ${d2}`
    case 'unknown': return 'date inconnue'
    default: return d1 || 'date inconnue'
  }
}

const QUALIFIER_LABELS: Record<DateQualifier, string> = {
  exact: 'Date exacte',
  about: 'Vers',
  before: 'Avant',
  after: 'Après',
  between: 'Entre',
  unknown: 'Inconnue',
}

export { QUALIFIER_LABELS }

/** "1920" → affichage compact pour les cartes. */
export function compactDate(d: DateValue | null | undefined): string | null {
  if (!d) return null
  if (d.qualifier === 'unknown') return null
  if (d.qualifier === 'about' && d.d1) return `vers ${d.d1}`
  if (d.qualifier === 'between') {
    const a = extractYear(d.d1)
    const b = extractYear(d.d2)
    if (a !== null && b !== null) return `${a}–${b}`
    return d.label
  }
  return d.d1 || null
}

export type DatePick = DateInput