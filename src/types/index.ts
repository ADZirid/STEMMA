// ---------------------------------------------------------------------------
// Types du domaine — STEMMA
// ---------------------------------------------------------------------------

export type Sex = 'M' | 'F' | 'X' | ''

/** Qualificatifs de date flexibles. */
export type DateQualifier = 'exact' | 'about' | 'before' | 'after' | 'between' | 'unknown'

export interface DateValue {
  id: string
  qualifier: DateQualifier
  d1: string
  d2: string
  sort_key: number | null
  label: string
}

export interface Person {
  id: string
  given_name: string
  surname: string
  birth_name: string
  sex: Sex
  profession: string
  description: string
  notes: string
  photo_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PersonDated extends Person {
  birth: { date: DateValue | null; place: string }
  death: { date: DateValue | null; place: string }
}

export type UnionType = 'mariage' | 'union' | 'concubinage' | 'relation' | 'autre'
export type UnionStatus = 'actuel' | 'passe' | 'divorce' | 'separe' | 'autre'

export interface UnionFamily {
  id: string
  type: UnionType
  status: UnionStatus
  start_date_id: string | null
  end_date_id: string | null
  place: string
  notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RelationshipType =
  | 'biologique'
  | 'adopte'
  | 'beau-fils'
  | 'reconnu'
  | 'autre'

export interface PartnerLink {
  union_id: string
  person_id: string
  role: string
}

export interface ChildLink {
  union_id: string
  child_id: string
  relationship_type: RelationshipType
}

export interface ParentLink {
  parent_id: string
  child_id: string
  relationship_type: RelationshipType
  note: string
}

/** Union enrichie pour l'affichage. */
export interface UnionView {
  union: UnionFamily
  start: DateValue | null
  end: DateValue | null
  partners: Person[]
  children: { person: Person; relationship_type: RelationshipType }[]
}

export interface Source {
  id: string
  title: string
  author: string
  date: string
  archive: string
  reference: string
  url: string
  comment: string
  created_at: string
  updated_at: string
}

export interface Media {
  id: string
  original_name: string
  file_type: string
  size_bytes: number
  description: string
  rel_path: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// ÉVÉNEMENTS
// ---------------------------------------------------------------------------

export type EventType =
  | 'bapteme'
  | 'confirmation'
  | 'mariage'
  | 'divorce'
  | 'separation'
  | 'deces'
  | 'inhumation'
  | 'personnalise'

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  bapteme: 'Baptême',
  confirmation: 'Confirmation',
  mariage: 'Mariage',
  divorce: 'Divorce',
  separation: 'Séparation',
  deces: 'Décès',
  inhumation: 'Inhumation',
  personnalise: 'Personnalisé',
}

export interface GeneEvent {
  id: string
  person_id: string | null
  union_id: string | null
  type: EventType
  type_label: string
  date_id: string | null
  place: string
  description: string
  created_at: string
  updated_at: string
}

export interface GeneEventView extends GeneEvent {
  date: DateValue | null
  personName?: string
  unionLabel?: string
}