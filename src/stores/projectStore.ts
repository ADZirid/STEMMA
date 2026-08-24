// ---------------------------------------------------------------------------
// Store des projets — un projet = une base SQLite isolée.
// ---------------------------------------------------------------------------
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, DbError } from '@/database/client'

export interface ProjectStats {
  person_count: number
  union_count: number
  source_count: number
  media_count: number
}

export interface ProjectInfo extends ProjectStats {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface ProjectState {
  projects: ProjectInfo[]
  activeId: string | null
  loading: boolean
  error: string | null
  load: () => Promise<void>
  createProject: (name: string) => Promise<ProjectInfo>
  renameProject: (id: string, name: string) => Promise<void>
  trashProject: (id: string) => Promise<void>
  restoreFromTrash: (name: string) => Promise<void>
  setActive: (id: string | null) => void
}

const ACTIVE_KEY = 'ft.activeProject'

function readStoredActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeId: readStoredActive(),
  loading: false,
  error: null,

  load: async () => {
    if (!isTauri) throw new DbError('Tauri requis')
    set({ loading: true, error: null })
    try {
      const projects = (await invoke('project_list')) as ProjectInfo[]
      let activeId = get().activeId
      if (!activeId || !projects.some((p) => p.id === activeId)) {
        activeId = projects.length ? projects[0].id : null
        try {
          localStorage.setItem(ACTIVE_KEY, activeId ?? '')
        } catch {
          /* ignore */
        }
      }
      set({ projects, activeId, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
      throw e
    }
  },

  createProject: async (name) => {
    const p = (await invoke('project_create', { name })) as ProjectInfo
    set((s) => ({ projects: [...s.projects, p], activeId: p.id }))
    try {
      localStorage.setItem(ACTIVE_KEY, p.id)
    } catch {
      /* ignore */
    }
    return p
  },

  renameProject: async (id, name) => {
    await invoke('project_rename', { id, name })
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, name } : p,
      ),
    }))
  },

  trashProject: async (id) => {
    await invoke('project_trash', { id })
    const projects = get().projects.filter((p) => p.id !== id)
    const activeId = get().activeId === id ? (projects[0]?.id ?? null) : get().activeId
    set({ projects, activeId })
    try {
      localStorage.setItem(ACTIVE_KEY, activeId ?? '')
    } catch {
      /* ignore */
    }
  },

  restoreFromTrash: async (name) => {
    await invoke('trash_restore', { name })
    await get().load()
  },

  setActive: (id) => {
    set({ activeId: id })
    try {
      localStorage.setItem(ACTIVE_KEY, id ?? '')
    } catch {
      /* ignore */
    }
  },
}))

export function useActiveProject(): ProjectInfo | null {
  const { projects, activeId } = useProjectStore()
  return projects.find((p) => p.id === activeId) ?? null
}