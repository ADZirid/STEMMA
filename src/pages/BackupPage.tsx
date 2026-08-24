// ---------------------------------------------------------------------------
// Page Sauvegarde : .ftbackup (ZIP protégé par SHA-256 + chiffrement AES-256-GCM optionnel).
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { DatabaseBackup, Lock, Save, Unlock, Upload } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface BackupInfo {
  name: string
  path: string
  size_bytes: number
  created_at: string
}

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`
  return `${Math.max(1, Math.round(n / 1024))} Ko`
}

export function BackupPage() {
  const project = useActiveProject()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [busy, setBusy] = useState<null | 'create' | 'restore'>(null)

  // Password dialog state
  const [passwordDialog, setPasswordDialog] = useState<'create' | 'restore' | null>(null)
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)

  const reload = useCallback(async () => {
    try {
      setBackups((await invoke('backup_list')) as BackupInfo[])
    } catch (e) {
      toast.error(String(e))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function doCreate(pw?: string) {
    if (!project) return
    setBusy('create')
    try {
      await invoke('backup_create', {
        projectId: project.id,
        projectName: project.name,
        password: pw || null,
      })
      toast.success(pw ? 'Sauvegarde chiffrée créée' : 'Sauvegarde créée')
      reload()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusy(null)
    }
  }

  async function doRestore(pw?: string) {
    if (!project) return
    try {
      const sel = await open({ multiple: false, title: 'Choisir une sauvegarde .ftbackup' })
      if (!sel) return
      setBusy('restore')
      const rep = (await invoke('backup_restore', {
        projectId: project.id,
        backupPath: String(sel),
        password: pw || null,
      })) as { ok: boolean; message?: string }
      if (rep.ok) toast.success('Base restaurée depuis la sauvegarde')
      else toast.error(rep.message ?? 'Échec de la restauration')
      reload()
    } catch (e) {
      const msg = String(e)
      if (msg.includes('chiffrée') || msg.includes('mot de passe')) {
        setPasswordDialog('restore')
      } else {
        toast.error(msg)
      }
    } finally {
      setBusy(null)
    }
  }

  function handleCreate() {
    setPassword('')
    setUsePassword(false)
    setPasswordDialog('create')
  }

  function handleRestore() {
    setPassword('')
    doRestore()
  }

  function confirmPassword() {
    if (passwordDialog === 'create') {
      doCreate(usePassword ? password : undefined)
    } else if (passwordDialog === 'restore') {
      doRestore(password)
    }
    setPasswordDialog(null)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sauvegardes"
        subtitle="Fichier .ftbackup — base + médias + manifest. Chiffrement AES-256-GCM optionnel."
        actions={
          <>
            <Button onClick={handleCreate} disabled={busy !== null || !project}>
              <Save className="size-4" /> {busy === 'create' ? 'Création…' : 'Sauvegarder'}
            </Button>
            <Button variant="outline" onClick={handleRestore} disabled={busy !== null}>
              <Upload className="size-4" /> Restaurer…
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {backups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aucune sauvegarde. Créez-en une pour protéger votre arbre.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {backups.map((b) => (
              <div key={b.name} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <DatabaseBackup className="size-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtSize(b.size_bytes)}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Dialog */}
      <Dialog open={passwordDialog !== null} onOpenChange={() => setPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {passwordDialog === 'create' ? (
                <>
                  <Lock className="size-5" /> Protéger la sauvegarde
                </>
              ) : (
                <>
                  <Unlock className="size-5" /> Sauvegarde chiffrée
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {passwordDialog === 'create' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="accent-primary"
                />
                Chiffrer cette sauvegarde (AES-256-GCM)
              </label>
            )}
            {(usePassword || passwordDialog === 'restore') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {passwordDialog === 'restore'
                    ? 'Mot de passe de la sauvegarde'
                    : 'Choisir un mot de passe'}
                </label>
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmPassword()
                  }}
                  autoFocus
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPasswordDialog(null)}>
                Annuler
              </Button>
              <Button onClick={confirmPassword}>
                {passwordDialog === 'create' ? 'Créer' : 'Restaurer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
