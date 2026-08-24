// ---------------------------------------------------------------------------
// Libellés des types et statuts d'union.
// ---------------------------------------------------------------------------
import type { UnionFamily } from '@/types'

export const unionTypeLabel: Record<UnionFamily['type'], string> = {
  mariage: 'Mariage',
  union: 'Union',
  concubinage: 'Concubinage',
  relation: 'Relation',
  autre: 'Autre',
}

export const unionStatusLabel: Record<UnionFamily['status'], string> = {
  actuel: 'Actuel',
  passe: 'Passé',
  divorce: 'Divorcé',
  separe: 'Séparé',
  autre: 'Autre',
}

export const relationshipTypeLabel: Record<string, string> = {
  biologique: 'Biologique',
  adopte: 'Adopté',
  'beau-fils': 'Beau-fils',
  reconnu: 'Reconnu',
  autre: 'Autre',
}