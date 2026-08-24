-- FamilyTree Local — schéma v1
-- Base de données par projet d'arbre généalogique.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- PERSONNES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS person (
  id          TEXT PRIMARY KEY,
  given_name  TEXT NOT NULL DEFAULT '',
  surname     TEXT NOT NULL DEFAULT '',
  birth_name  TEXT NOT NULL DEFAULT '',
  sex         TEXT NOT NULL DEFAULT 'X',
  profession  TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  photo_id    TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_person_surname ON person(surname, given_name);
CREATE INDEX IF NOT EXISTS idx_person_deleted ON person(deleted_at);

-- Dates flexibles : exacte, vers, avant, après, entre, inconnue
CREATE TABLE IF NOT EXISTS date_value (
  id        TEXT PRIMARY KEY,
  qualifier TEXT NOT NULL DEFAULT 'exact',
  d1        TEXT NOT NULL DEFAULT '',
  d2        TEXT NOT NULL DEFAULT '',
  sort_key  INTEGER,
  label     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS person_date (
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL, -- 'birth' | 'death'
  date_id   TEXT NOT NULL REFERENCES date_value(id) ON DELETE CASCADE,
  place     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (person_id, kind)
);

-- ---------------------------------------------------------------------------
-- UNIONS / FAMILLES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS union_family (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL DEFAULT 'union',
  status        TEXT NOT NULL DEFAULT 'actuel',
  start_date_id TEXT REFERENCES date_value(id) ON DELETE SET NULL,
  end_date_id   TEXT REFERENCES date_value(id) ON DELETE SET NULL,
  place         TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_union_deleted ON union_family(deleted_at);

-- Partenaires : plusieurs par union (aucun champ husbandId/wifeId)
CREATE TABLE IF NOT EXISTS union_partner (
  union_id  TEXT NOT NULL REFERENCES union_family(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (union_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_up_person ON union_partner(person_id);

-- Enfants rattachés à l'UNION (nombre illimité par union)
CREATE TABLE IF NOT EXISTS union_child (
  union_id          TEXT NOT NULL REFERENCES union_family(id) ON DELETE CASCADE,
  child_id          TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'biologique',
  PRIMARY KEY (union_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_uc_child ON union_child(child_id);

-- Liens directs parent -> enfant (adoption, parent seul sans union, parent inconnu)
CREATE TABLE IF NOT EXISTS parent_child (
  parent_id         TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  child_id          TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'biologique',
  note              TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (parent_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_pc_child ON parent_child(child_id);

-- ---------------------------------------------------------------------------
-- ÉVÉNEMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event (
  id          TEXT PRIMARY KEY,
  person_id   TEXT REFERENCES person(id) ON DELETE CASCADE,
  union_id    TEXT REFERENCES union_family(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'personnalise',
  type_label  TEXT NOT NULL DEFAULT '',
  date_id     TEXT REFERENCES date_value(id) ON DELETE SET NULL,
  place       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_event_person ON event(person_id);

-- ---------------------------------------------------------------------------
-- SOURCES / CITATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT '',
  date       TEXT NOT NULL DEFAULT '',
  archive    TEXT NOT NULL DEFAULT '',
  reference  TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL DEFAULT '',
  comment    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS citation (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- person | union | event | media | date
  entity_id   TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_citation_entity ON citation(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- MÉDIAS (fichiers stockés dans <projet>/media/, référencés par chemin relatif)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  original_name TEXT NOT NULL DEFAULT '',
  file_type     TEXT NOT NULL DEFAULT 'autre', -- jpg | png | webp | pdf | autre
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  description   TEXT NOT NULL DEFAULT '',
  rel_path      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS media_link (
  media_id    TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- person | union | event | source
  entity_id   TEXT NOT NULL,
  caption     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (media_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_mlink_entity ON media_link(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- RECHERCHE (texte normalisé sans accents, mis à jour côté client)
-- search_text => lowercase, sans accents, espaces uniques
-- sort_name   => "DUPONT JEAN"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS person_search (
  person_id   TEXT PRIMARY KEY REFERENCES person(id) ON DELETE CASCADE,
  sort_name   TEXT NOT NULL,
  search_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_psearch_text ON person_search(search_text);

-- ---------------------------------------------------------------------------
-- Version du schéma
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', '1');