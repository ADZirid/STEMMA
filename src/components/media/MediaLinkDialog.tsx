// ---------------------------------------------------------------------------
// Dialogue : sélectionner un média existant pour le lier à une personne.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Link, Image, FileText } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { linkMedia, setProfilePhoto } from '@/database/repositories/mediaRepo'
import { useActiveProject } from '@/stores/projectStore'
import { toast } from 'sonner'

interface MediaFile {
  abs_path: string
  rel_path: string
  file_type: string
  size_bytes: number
}

interface MediaLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: 'person' | 'union' | 'event'
  entityId: string
  onLinked?: () => void
}

export function MediaLinkDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  onLinked,
}: MediaLinkDialogProps) {
  const project = useActiveProject()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!project || !open) return
    try {
      const res = (await invoke('media_list', { projectId: project.id })) as { files: MediaFile[] }
      setFiles(res.files ?? [])
    } catch (e) {
      toast.error(String(e))
    }
  }, [project, open])

  useEffect(() => { load() }, [load])

  async function handleLink() {
    if (!project || !selected) return
    setSaving(true)
    try {
      await linkMedia(project.id, selected, entityType, entityId, caption)
      toast.success('Média lié')
      onOpenChange(false)
      setSelected(null)
      setCaption('')
      onLinked?.()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleSetProfile() {
    if (!project || !selected || entityType !== 'person') return
    setSaving(true)
    try {
      await setProfilePhoto(project.id, entityId, selected)
      toast.success('Photo de profil définie')
      onOpenChange(false)
      setSelected(null)
      setCaption('')
      onLinked?.()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const images = files.filter((f) => ['jpg', 'png', 'webp'].includes(f.file_type))
  const others = files.filter((f) => !['jpg', 'png', 'webp'].includes(f.file_type))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="size-4" /> Lier un média
          </DialogTitle>
        </DialogHeader>

        {files.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun média importé. Importez des fichiers depuis la page Médias d'abord.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
            {images.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Photos</h4>
                <div className="grid grid-cols-4 gap-2">
                  {images.map((f) => (
                    <button
                      key={f.rel_path}
                      onClick={() => setSelected(f.rel_path)}
                      className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                        selected === f.rel_path
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      <img
                        src={convertFileSrc(f.abs_path)}
                        alt={f.rel_path.split('/').pop() ?? ''}
                        className="size-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/60 px-1 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                        {f.rel_path.split('/').pop()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {others.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Documents</h4>
                <div className="space-y-1">
                  {others.map((f) => (
                    <button
                      key={f.rel_path}
                      onClick={() => setSelected(f.rel_path)}
                      className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${
                        selected === f.rel_path
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted'
                      }`}
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.rel_path.split('/').pop()}</span>
                      <span className="text-xs text-muted-foreground">
                        {(f.size_bytes / 1024).toFixed(0)} Ko
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Légende (optionnel)</Label>
              <Input
                placeholder="Description du média…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          {entityType === 'person' && selected && (
            <Button variant="outline" onClick={handleSetProfile} disabled={saving}>
              <Image className="size-4" /> Définir comme photo de profil
            </Button>
          )}
          <Button onClick={handleLink} disabled={!selected || saving}>
            {saving ? 'Lien…' : 'Lier ce média'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
