// ---------------------------------------------------------------------------
// Affichage des médias : URLs locales servies par Tauri (convertFileSrc).
// Aucun fichier ne quitte la machine.
// ---------------------------------------------------------------------------
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from './client'

/** Chemin absolu d'un média (via Rust), puis URL locale. */
export async function mediaSrc(projectId: string, relPath: string): Promise<string> {
  if (!isTauri) return ''
  try {
    const abs = (await invoke('media_path', { projectId, relPath })) as string
    return convertFileSrc(abs)
  } catch {
    return ''
  }
}

/** Source directe si on possède déjà le chemin absolu. */
export function mediaSrcFromAbs(absPath: string): string {
  return convertFileSrc(absPath)
}