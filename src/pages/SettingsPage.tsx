// ---------------------------------------------------------------------------
// Page Paramètres : gestion du projet (nom, corbeille) et diagnostics.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'
import { Settings, ShieldCheck, Trash2, RefreshCw, Archive, Sprout } from 'lucide-react'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { integrityCheck } from '@/database/client'
import { seedDemoProject } from '@/features/seed/demo'
import { toast } from 'sonner'

export function SettingsPage() {
  const project = useActiveProject()
  const navigate = useNavigate()
  const renameProject = useProjectStore((s) => s.renameProject)
  const trashProject = useProjectStore((s) => s.trashProject)
  const restoreFromTrash = useProjectStore((s) => s.restoreFromTrash)
  const [name, setName] = useState('')
  const [checking, setChecking] = useState(false)
  const [trashItems, setTrashItems] = useState<{ name: string; path: string }[]>([])
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    if (project) setName(project.name)
  }, [project])

  async function loadTrash() {
    try {
      setTrashItems((await invoke('trash_list')) as { name: string; path: string }[])
    } catch {
      /* sans Tauri */
    }
  }

  useEffect(() => {
    loadTrash()
  }, [])

  async function saveName() {
    if (!project || !name.trim()) return
    try {
      await renameProject(project.id, name.trim())
      toast.success('Projet renommé')
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function check() {
    if (!project) return
    setChecking(true)
    try {
      const res = await integrityCheck(project.id)
      if (res.ok) toast.success('Intégrité de la base : OK')
      else toast.error(`Problèmes détectés : ${res.details.join(', ')}`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setChecking(false)
    }
  }

  async function doTrash() {
    if (!project) return
    try {
      await trashProject(project.id)
      toast.success('Projet déplacé dans la corbeille (sauvegarde auto créée)')
      navigate('/')
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function restore(name: string) {
    try {
      await restoreFromTrash(name)
      toast.success('Projet restauré')
      loadTrash()
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function seedDemo() {
    setSeeding(true)
    try {
      await seedDemoProject()
      await useProjectStore.getState().load()
      toast.success('Données de démonstration créées')
      navigate('/')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Paramètres" subtitle="Configuration du projet et maintenance" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid max-w-3xl gap-4 p-4">
          {project && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Settings className="size-4" /> Projet actif
              </h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Nom du projet</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button className="self-end" onClick={saveName}>Renommer</Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" /> Diagnostic
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Vérifie l'intégrité de la base SQLite du projet (recherche d'incohérences).
            </p>
            <Button variant="outline" onClick={check} disabled={checking || !project}>
              <RefreshCw className="size-4" /> {checking ? 'Vérification…' : 'Vérifier l’intégrité'}
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Sprout className="size-4" /> Découverte
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Crée un projet de démonstration avec plusieurs générations, unions multiples et
              demi-frères/sœurs, pour explorer l'application.
            </p>
            <Button variant="outline" onClick={seedDemo} disabled={seeding}>
              <Sprout className="size-4" /> {seeding ? 'Création…' : 'Charger des données de démonstration'}
            </Button>
          </div>

          <div className="rounded-xl border border-destructive/30 bg-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
              <Archive className="size-4" /> Zone dangereuse
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Déplacer le projet dans la corbeille crée d'abord une sauvegarde automatique
              <strong> .ftbackup</strong>, puis déplace le dossier projet.
            </p>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmTrash(true)} disabled={!project}>
              <Trash2 className="size-4" /> Mettre le projet à la corbeille
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Corbeille ({trashItems.length})</h3>
            {trashItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">La corbeille est vide.</p>
            ) : (
              <div className="grid gap-2">
                {trashItems.map((t) => (
                  <div key={t.name} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    <Trash2 className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <Button variant="outline" size="sm" onClick={() => restore(t.name)}>
                      Restaurer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
            <strong className="text-foreground">STEMMA</strong> — application 100&nbsp;%
            locale. Vos arbres, photos et sources restent sur cet ordinateur.
          </div>
        </div>
      </div>

      <AlertDialog open={confirmTrash} onOpenChange={setConfirmTrash}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mettre le projet à la corbeille ?</AlertDialogTitle>
            <AlertDialogDescription>
              Une sauvegarde automatique sera créée avant le déplacement. Vous pourrez restaurer
              le projet depuis la corbeille ou sa sauvegarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doTrash}>Oui, je confirme</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}