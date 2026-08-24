// ---------------------------------------------------------------------------
// Accueil : état du projet actif + actions rapides.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, HeartHandshake, ScrollText, Image, TreePine, Plus, FolderPlus } from 'lucide-react'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const createProject = useProjectStore((s) => s.createProject)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) {
      toast.error('Donnez un nom au projet')
      return
    }
    setBusy(true)
    try {
      await createProject(name.trim())
      toast.success('Projet créé')
      setName('')
      onOpenChange(false)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
          <DialogDescription>
            Un projet = un arbre généalogique complet, stocké uniquement sur votre ordinateur.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label className="text-xs">Nom du projet</Label>
          <Input
            autoFocus
            placeholder="Ma famille"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            <FolderPlus className="size-4" />
            {busy ? 'Création…' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { projects, activeId, load, loading } = useProjectStore()
  const project = useActiveProject()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (loading === false && !projects.length) {
      useProjectStore.getState().load().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, projects.length])

  const stats = project
    ? [
        { label: 'Personnes', value: project.person_count, icon: Users, to: '/people' },
        { label: 'Unions', value: project.union_count, icon: HeartHandshake, to: '/families' },
        { label: 'Sources', value: project.source_count, icon: ScrollText, to: '/sources' },
        { label: 'Médias', value: project.media_count, icon: Image, to: '/media' },
      ]
    : []

  if (!project) {
    return (
      <div>
        <PageHeader title="Accueil" subtitle="STEMMA — aucune donnée ne quitte cet ordinateur" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <TreePine className="mx-auto mb-3 size-10 text-primary" />
            <h2 className="text-lg font-semibold">Aucun projet actif</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Créez votre premier arbre généalogique ou choisissez-en un existant.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={() => setCreateOpen(true)}>
                <FolderPlus className="size-4" /> Nouveau projet
              </Button>
              {projects.length > 0 && (
                <Button variant="outline" onClick={() => load().catch(() => {})}>
                  Rafraîchir
                </Button>
              )}
            </div>
            {projects.filter((p) => p.id !== activeId).length > 0 && (
              <div className="mt-6 border-t pt-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Autres projets</div>
                {projects
                  .filter((p) => p.id !== activeId)
                  .map((p) => (
                    <Button
                      key={p.id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => useProjectStore.getState().setActive(p.id)}
                    >
                      {p.name}
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </div>
        <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={`Créé le ${new Date(project.created_at).toLocaleDateString('fr-FR')} · Mis à jour le ${new Date(project.updated_at).toLocaleDateString('fr-FR')}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <FolderPlus className="size-4" /> Nouveau projet
            </Button>
            <Button onClick={() => navigate('/tree')}>
              <TreePine className="size-4" /> Voir l'arbre
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.to)}
            className="group rounded-xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <s.icon className="size-5 text-primary" />
            <div className="mt-3 text-2xl font-semibold tabular-nums">{s.value ?? 0}</div>
            <div className="text-xs text-muted-foreground group-hover:text-foreground">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 pt-0 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Actions rapides</h3>
          <div className="grid gap-2">
            <Button variant="outline" className="justify-start" onClick={() => navigate('/people?new=1')}>
              <Plus className="size-4" /> Ajouter une personne
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/families?new=1')}>
              <HeartHandshake className="size-4" /> Ajouter une union
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/backup')}>
              <ScrollText className="size-4" /> Faire une sauvegarde
            </Button>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">Confidentialité</h3>
          <p className="text-sm text-muted-foreground">
            100&nbsp;% local&nbsp;: les arbres, photos et sources vivent dans votre espace de données
            personnel. Aucune information n'est envoyée sur Internet.
          </p>
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}