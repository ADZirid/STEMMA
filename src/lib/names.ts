// ---------------------------------------------------------------------------
// Affichage des noms et dates.
// ---------------------------------------------------------------------------
import type { Person, PersonDated } from '@/types'
import { compactDate } from './dates'

export function givenNameFirst(p: Pick<Person, 'given_name' | 'surname'>): string {
  return [p.given_name.trim(), p.surname.trim()].filter(Boolean).join(' ').trim() || '—'
}

export function displayName(p: Pick<Person, 'given_name' | 'surname'>): string {
  return givenNameFirst(p)
}

export function nameWithYears(p: PersonDated): string {
  const parts = [givenNameFirst(p)]
  const b = compactDate(p.birth.date)
  const d = compactDate(p.death.date)
  if (b || d) {
    parts.push(`(${b ?? '?'} – ${d ?? '?'})`)
  }
  return parts.join(' ')
}

export function initials(p: Pick<Person, 'given_name' | 'surname'>): string {
  const a = (p.given_name.trim()[0] ?? '').toUpperCase()
  const b = (p.surname.trim()[0] ?? '').toUpperCase()
  return (a + b) || '?'
}

export function familyLabel(personCount: number): string {
  return personCount === 1 ? '1 personne' : `${personCount} personnes`
}