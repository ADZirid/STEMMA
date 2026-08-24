// ---------------------------------------------------------------------------
// Formulaire d'une UNION : type, statut, dates, lieu, partenaires, enfants.
// Plusieurs partenaires possibles (pas de husbandId/wifeId).
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DateField, type DateFieldValue } from '@/components/person/DateField'
import type { UnionFamily, UnionView, RelationshipType } from '@/types'
import { useActiveProject } from '@/stores/projectStore'
import { createUnion, updateUnion } from '@/database/repositories/unionRepo'
import { toast } from 'sonner'

export interface ChildEntryInput {
  child_id: string
  relationship_type: RelationshipType
}

export function UnionFormDialog({
  open,
  onOpenChange,
  unionId,
  view,
  initialPartnerIds,
  people,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  unionId?: string | null
  view?: UnionView | null
  initialPartnerIds?: string[]
  people: { id: string; label: string }[]
  onSaved: () => void
}) {
  const project = useActiveProject()
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<UnionFamily['type']>('union')
  const [status, setStatus] = useState<UnionFamily['status']>('actuel')
  const [place, setPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [start, setStart] = useState<DateFieldValue>({ qualifier: 'unknown', d1: '', d2: '' })
  const [end, setEnd] = useState<DateFieldValue>({ qualifier: 'unknown', d1: '', d2: '' })
  const [partnerIds, setPartnerIds] = useState<string[]>([])
  const [children, setChildren] = useState<ChildEntryInput[]>([])

  useEffect(() => {
    if (open) {
      setPartnerIds(view ? view.partners.map((p) => p.id) : initialPartnerIds ?? [])
      setChildren(
        view
          ? view.children.map((c) => ({ child_id: c.person.id, relationship_type: c.relationship_type }))
          : [],
      )
      setType(view?.union.type ?? 'union')
      setStatus(view?.union.status ?? 'actuel')
      setPlace(view?.union.place ?? '')
      setNotes(view?.union.notes ?? '')
      setStart(
        view?.start
          ? { qualifier: view.start.qualifier, d1: view.start.d1, d2: view.start.d2 }
          : { qualifier: 'unknown' as const, d1: '', d2: '' },
      )
      setEnd(
        view?.end
          ? { qualifier: view.end.qualifier, d1: view.end.d1, d2: view.end.d2 }
          : { qualifier: 'unknown' as const, d1: '', d2: '' },
      )
    }
  }, [open, view, initialPartnerIds])

  async function submit() {
    if (!project) return
    if (partnerIds.length === 0) {
      toast.error('Ajoutez au moins un partenaire')
      return
    }
    setSaving(true)
    try {
      if (unionId) {
        await updateUnion(project.id, unionId, {
          type, status, place, notes, start: { date: start }, end: { date: end },
          partner_ids: partnerIds, children,
        })
      } else {
        await createUnion(project.id, {
          type, status, place, notes, start: { date: start }, end: { date: end },
          partner_ids: partnerIds, children,
        })
      }
      toast.success(unionId ? 'Union modifiée' : 'Union créée')
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const available = people.filter((p) => !partnerIds.includes(p.id))
  const availableChildren = people.filter((p) => !partnerIds.includes(p.id) && !children.some((c) => c.child_id === p.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{unionId ? 'Modifier l’union' : 'Nouvelle union'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Type de relation</Label>
              <Select value={type} onValueChange={(v) => setType(v as UnionFamily['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mariage">Mariage</SelectItem>
                  <SelectItem value="union">Union</SelectItem>
                  <SelectItem value="concubinage">Concubinage</SelectItem>
                  <SelectItem value="relation">Relation</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as UnionFamily['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actuel">Actuel</SelectItem>
                  <SelectItem value="passe">Passé</SelectItem>
                  <SelectItem value="divorce">Divorce</SelectItem>
                  <SelectItem value="separe">Séparation</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DateField label="Début" value={start} onChange={setStart} />
          <DateField label="Fin" value={end} onChange={setEnd} />

          <div className="grid gap-1.5">
            <Label className="text-xs">Lieu</Label>
            <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ville" />
          </div>

          {/* Partenaires */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Partenaires</Label>
            {partnerIds.map((pid) => {
              const label = people.find((p) => p.id === pid)?.label ?? 'Inconnu'
              return (
                <div key={pid} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <button onClick={() => setPartnerIds(partnerIds.filter((x) => x !== pid))}>
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              )
            })}
            <Select
              value=""
              onValueChange={(v) => {
                if (v && !partnerIds.includes(v)) setPartnerIds([...partnerIds, v])
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="+ Ajouter un partenaire…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Enfants */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Enfants</Label>
            {children.map((c, i) => {
              const label = people.find((p) => p.id === c.child_id)?.label ?? 'Inconnu'
              return (
                <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <Select
                    value={c.relationship_type}
                    onValueChange={(v) => {
                      setChildren(children.map((x, j) => (j === i ? { ...x, relationship_type: v as RelationshipType } : x)))
                    }}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="biologique">Biologique</SelectItem>
                      <SelectItem value="adopte">Adopté</SelectItem>
                      <SelectItem value="beau-fils">Beau-fils</SelectItem>
                      <SelectItem value="reconnu">Reconnu</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => setChildren(children.filter((_, j) => j !== i))}>
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              )
            })}
            <Select
              value=""
              onValueChange={(v) => {
                if (v && !children.some((c) => c.child_id === v)) {
                  setChildren([...children, { child_id: v, relationship_type: 'biologique' }])
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="+ Ajouter un enfant…" />
              </SelectTrigger>
              <SelectContent>
                {availableChildren.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving || partnerIds.length === 0}>
            <Plus className="size-4" />
            {saving ? 'Enregistrement…' : unionId ? 'Enregistrer' : 'Créer l’union'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}