// ---------------------------------------------------------------------------
// Repository des médias : liaison média → personne/union + photo de profil.
// ---------------------------------------------------------------------------
import { exec, query } from '@/database/client'
import type { Media } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaLink {
  media_id: string
  entity_type: string
  entity_id: string
  caption: string
}

export interface MediaWithLinks extends Media {
  links: MediaLink[]
}

// ---------------------------------------------------------------------------
// Liaison média → entité
// ---------------------------------------------------------------------------

/** Lier un média à une personne, union ou événement. */
export async function linkMedia(
  projectId: string,
  mediaId: string,
  entityType: string,
  entityId: string,
  caption = '',
): Promise<void> {
  await exec(
    projectId,
    'INSERT OR REPLACE INTO media_link(media_id, entity_type, entity_id, caption) VALUES(?1,?2,?3,?4)',
    [mediaId, entityType, entityId, caption.trim()],
  )
}

/** Retirer un lien média → entité. */
export async function unlinkMedia(
  projectId: string,
  mediaId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await exec(
    projectId,
    'DELETE FROM media_link WHERE media_id=?1 AND entity_type=?2 AND entity_id=?3',
    [mediaId, entityType, entityId],
  )
}

/** Lister les liens d'un média. */
export async function getLinksForMedia(projectId: string, mediaId: string): Promise<MediaLink[]> {
  const rows = await query<MediaLink>(
    projectId,
    'SELECT media_id, entity_type, entity_id, caption FROM media_link WHERE media_id=?1',
    [mediaId],
  )
  return rows
}

/** Lister les médias liés à une entité. */
export async function getMediaForEntity(
  projectId: string,
  entityType: string,
  entityId: string,
): Promise<Media[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT m.* FROM media m
     JOIN media_link ml ON ml.media_id = m.id
     WHERE ml.entity_type=?1 AND ml.entity_id=?2
     ORDER BY m.original_name COLLATE NOCASE`,
    [entityType, entityId],
  )
  return rows.map(mapMedia)
}

/** Lister les médias liés à une personne (via media_link). */
export async function getMediaForPerson(projectId: string, personId: string): Promise<Media[]> {
  return getMediaForEntity(projectId, 'person', personId)
}

// ---------------------------------------------------------------------------
// Photo de profil
// ---------------------------------------------------------------------------

/** Définir la photo de profil d'une personne (met à jour person.photo_id). */
export async function setProfilePhoto(
  projectId: string,
  personId: string,
  mediaId: string,
): Promise<void> {
  await exec(
    projectId,
    "UPDATE person SET photo_id=?1, updated_at=datetime('now') WHERE id=?2",
    [mediaId, personId],
  )
  // Aussi créer un lien media_link pour traçabilité
  await exec(
    projectId,
    'INSERT OR IGNORE INTO media_link(media_id, entity_type, entity_id, caption) VALUES(?1,?2,?3,?4)',
    [mediaId, 'person', personId, 'photo de profil'],
  )
}

/** Retirer la photo de profil d'une personne. */
export async function clearProfilePhoto(projectId: string, personId: string): Promise<void> {
  await exec(
    projectId,
    "UPDATE person SET photo_id='', updated_at=datetime('now') WHERE id=?1",
    [personId],
  )
}

/** Récupérer le chemin absolu de la photo de profil d'une personne. */
export async function getProfilePhotoPath(projectId: string, personId: string): Promise<string | null> {
  const rows = await query<{ photo_id: string }>(
    projectId,
    'SELECT photo_id FROM person WHERE id=?1',
    [personId],
  )
  const photoId = rows[0]?.photo_id
  if (!photoId) return null
  const mediaRows = await query<{ rel_path: string }>(
    projectId,
    'SELECT rel_path FROM media WHERE id=?1',
    [photoId],
  )
  return mediaRows[0]?.rel_path ?? null
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapMedia(r: Record<string, unknown>): Media {
  return {
    id: String(r.id ?? ''),
    original_name: String(r.original_name ?? ''),
    file_type: String(r.file_type ?? ''),
    size_bytes: Number(r.size_bytes ?? 0),
    description: String(r.description ?? ''),
    rel_path: String(r.rel_path ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}
