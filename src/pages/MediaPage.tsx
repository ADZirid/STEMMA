// ---------------------------------------------------------------------------
// Page Médias : import depuis l'ordinateur (jamais le réseau) + galerie locale.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Image, Upload, Trash2 } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface MediaFile {
  abs_path: string
  rel_path: string
  file_type: string
  size_bytes: number
}

export function MediaPage() {
  const project = useActiveProject()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [importing, setImporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null)

  const reload = useCallback(async () => {
    if (!project) return
    try {
      const res = (await invoke('media_list', { projectId: project.id })) as { files: MediaFile[] }
      setFiles(res.files ?? [])
    } catch (e) {
      toast.error(String(e))
    }
  }, [project])

  useEffect(() => {
    reload()
  }, [reload])

  async function importFile() {
    if (!project) return
    try {
      const sel = await open({ multiple: false, title: 'Importer un média' })
      if (!sel) return
      setImporting(true)
      await invoke('media_import', { projectId: project.id, sourcePath: String(sel) })
      toast.success('Média importé')
      reload()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImporting(false)
    }
  }

  async function confirmDelete() {
    if (!project || !deleteTarget) return
    const absPath = deleteTarget.abs_path
    const rel = `media/${absPath.split(/[\\/]/).pop()}`
    try {
      const recs = (await invoke('db_query', {
        projectId: project.id,
        sql: 'SELECT id FROM media WHERE rel_path=?1',
        params: [rel],
      })) as { id: string }[]
      if (recs[0]) {
        await invoke('media_delete', { projectId: project.id, id: recs[0].id })
      } else {
        await invoke('db_exec', {
          projectId: project.id,
          sql: 'DELETE FROM media WHERE rel_path=?1',
          params: [rel],
        })
      }
      toast.success('Média supprimé')
      reload()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleteTarget(null)
    }
  }

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  const images = files.filter((f) => ['jpg', 'png', 'webp'].includes(f.file_type))
  const others = files.filter((f) => !['jpg', 'png', 'webp'].includes(f.file_type))

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Médias"
        subtitle={`${files.length} fichier(s) importé(s) — stockés localement dans le projet`}
        actions={
          <Button onClick={importFile} disabled={importing}>
            <Upload className="size-4" /> {importing ? 'Import…' : 'Importer'}
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {files.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aucun média. Importez des photos ou documents depuis votre ordinateur — rien ne part en ligne.
          </div>
        ) : (
          <>
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {images.map((f) => (
                  <div key={f.rel_path} className="group relative overflow-hidden rounded-xl border bg-card">
                    <img
                      src={convertFileSrc(f.abs_path)}
                      alt={f.rel_path.split('/').pop() ?? ''}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                      <span className="truncate text-[11px] text-white">
                        {f.rel_path.split('/').pop()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-white hover:bg-white/20"
                        onClick={() => setDeleteTarget(f)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Documents</h3>
                {others.map((f) => (
                  <div key={f.rel_path} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
                    <Image className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.rel_path.split('/').pop()}</span>
                    <span className="text-xs text-muted-foreground">
                      {(f.size_bytes / 1024).toFixed(0)} Ko
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(f)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce média ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le fichier sera définitivement supprimé du projet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}