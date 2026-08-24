// ---------------------------------------------------------------------------
// Page Sources : bibliographie (CRUD simple).
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  createSource, updateSource, deleteSource, listSources,
} from '@/database/repositories/sourceRepo'
import type { Source } from '@/types'
import { toast } from 'sonner'

const EMPTY = { title: '', author: '', date: '', archive: '', reference: '', url: '', comment: '' }

export function SourcesPage() {
  const project = useActiveProject()
  const [sources, setSources] = useState<Source[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Source | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [deleting, setDeleting] = useState<Source | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!project) return
    setSources(await listSources(project.id))
  }, [project])

  useEffect(() => {
    reload()
  }, [reload])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setFormOpen(true)
  }

  function openEdit(s: Source) {
    setEditing(s)
    setForm({
      title: s.title, author: s.author, date: s.date, archive: s.archive,
      reference: s.reference, url: s.url, comment: s.comment,
    })
    setFormOpen(true)
  }

  async function save() {
    if (!project) return
    if (!form.title.trim()) {
      toast.error('Titre requis')
      return
    }
    setBusy(true)
    try {
      if (editing) await updateSource(project.id, editing.id, form)
      else await createSource(project.id, form)
      toast.success(editing ? 'Source modifiée' : 'Source créée')
      setFormOpen(false)
      reload()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    if (!project || !deleting) return
    await deleteSource(project.id, deleting.id)
    toast.success('Source supprimée')
    setDeleting(null)
    reload()
  }

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sources"
        subtitle={`${sources.length} source${sources.length > 1 ? 's' : ''}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Nouvelle source
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {sources.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aucune source. Ajoutez des références bibliographiques ou d'archives.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((s) => (
              <div key={s.id} className="group rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight">{s.title || 'Sans titre'}</h3>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(s)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {s.author && <p className="mt-1 text-sm text-muted-foreground">{s.author}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {s.date && <span className="rounded bg-muted px-1.5 py-0.5">{s.date}</span>}
                  {s.archive && <span className="rounded bg-muted px-1.5 py-0.5">{s.archive}</span>}
                  {s.reference && <span className="rounded bg-muted px-1.5 py-0.5">{s.reference}</span>}
                </div>
                {s.comment && <p className="mt-2 text-xs text-muted-foreground">{s.comment}</p>}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block max-w-full truncate text-xs text-primary underline"
                  >
                    {s.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la source' : 'Nouvelle source'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Auteur</Label>
                <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Date</Label>
                <Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} placeholder="1892" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Dépôt / archive</Label>
                <Input value={form.archive} onChange={(e) => setForm({ ...form, archive: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Cote / référence</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Commentaire</Label>
              <Textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la source ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.title ?? ''} » sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}