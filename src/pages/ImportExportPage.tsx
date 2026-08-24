// ---------------------------------------------------------------------------
// Page Import / Export : GEDCOM (import + export) + export PDF/image.
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { open, save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import {
  FileJson, FileText, Download, Upload, TreePine, UserRound,
} from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { exportGedcom } from '@/features/export/gedcom'
import { importGedcom } from '@/features/import/gedcomImport'
import { toast } from 'sonner'

export function ImportExportPage() {
  const project = useActiveProject()
  const navigate = useNavigate()
  const [busyExport, setBusyExport] = useState(false)
  const [busyImport, setBusyImport] = useState(false)

  // --- Export GEDCOM ---
  async function doExport() {
    if (!project) return
    setBusyExport(true)
    try {
      const ged = await exportGedcom(project.id)
      const defaultName = `${project.name.replace(/[^a-z0-9-_ ]/gi, '_')}.ged`
      const path = await save({
        title: 'Enregistrer l\'export GEDCOM',
        defaultPath: defaultName,
        filters: [{ name: 'GEDCOM', extensions: ['ged'] }],
      })
      if (!path) { setBusyExport(false); return }
      const blob = new Blob([ged], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = path.split(/[/\\]/).pop() || defaultName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success(`GEDCOM exporté : ${path}`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusyExport(false)
    }
  }

  // --- Import GEDCOM ---
  async function doImport() {
    if (!project) return
    setBusyImport(true)
    try {
      const sel = await open({
        title: 'Importer un fichier GEDCOM',
        multiple: false,
        filters: [{ name: 'GEDCOM', extensions: ['ged', 'gedcom'] }],
      })
      if (!sel) { setBusyImport(false); return }

      // Lire le fichier via commande Rust (évite le plugin fs)
      const path = typeof sel === 'string' ? sel : String(sel)
      const text = await invoke<string>('read_file_text', { path })

      // Importer
      const result = await importGedcom(project.id, text)

      // Afficher le résultat
      const msgs: string[] = []
      if (result.personsCreated > 0) msgs.push(`${result.personsCreated} personne(s) créée(s)`)
      if (result.unionsCreated > 0) msgs.push(`${result.unionsCreated} union(s) créée(s)`)
      if (result.childrenLinked > 0) msgs.push(`${result.childrenLinked} enfant(s) lié(s)`)

      if (result.warnings.length > 0) {
        msgs.push(`${result.warnings.length} avertissement(s)`)
      }

      toast.success(`Import terminé : ${msgs.join(', ')}`)

      if (result.warnings.length > 0) {
        for (const w of result.warnings.slice(0, 5)) {
          toast.warning(w)
        }
      }
    } catch (e) {
      toast.error(`Erreur d'import : ${String(e)}`)
    } finally {
      setBusyImport(false)
    }
  }

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Import / Export"
        subtitle="Échangez vos données avec d'autres logiciels de généalogie"
      />
      <div className="grid max-w-3xl gap-4 p-4">
        {/* Export GEDCOM */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <FileJson className="size-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Export GEDCOM 5.5.1</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Personnes, familles et dates au format standard, interopérable avec
                Gramps, RootsMagic, Legacy et autres logiciels de généalogie.
              </p>
            </div>
            <Button onClick={doExport} disabled={busyExport}>
              <Upload className="size-4" /> {busyExport ? 'Export…' : 'Exporter'}
            </Button>
          </div>
        </div>

        {/* Import GEDCOM */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <FileJson className="size-5 text-green-600" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Import GEDCOM 5.5.1</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Importez un fichier <code>.ged</code> depuis Gramps, RootsMagic,
                Ancestry, FamilySearch ou tout autre logiciel compatible GEDCOM.
                Les personnes, familles et relations seront créées automatiquement.
              </p>
            </div>
            <Button variant="outline" onClick={doImport} disabled={busyImport}>
              <Download className="size-4" /> {busyImport ? 'Import…' : 'Importer'}
            </Button>
          </div>
        </div>

        {/* Arbre PDF / Image */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <TreePine className="size-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Arbre généalogique</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Exportez l'arbre visuel en PDF, image PNG ou imprimez-le.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/tree')}>
              <FileText className="size-4" /> Ouvrir l'arbre
            </Button>
          </div>
        </div>

        {/* Fiche personne */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <UserRound className="size-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Fiche d'un membre</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Exportez la fiche détaillée d'une personne en PDF ou image.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/people')}>
              <UserRound className="size-4" /> Voir les profils
            </Button>
          </div>
        </div>

        {/* Restauration */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Upload className="size-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Restaurer un projet</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                L'import complet (base + médias) passe par les sauvegardes .ftbackup.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/backup')}>
              Aller à la restauration
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed bg-card/50 p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Confidentialité :</strong> aucun fichier
          n'est envoyé en ligne. Tout reste sur cet ordinateur.
        </div>
      </div>
    </div>
  )
}
