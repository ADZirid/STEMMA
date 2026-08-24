// ---------------------------------------------------------------------------
// Page Événements : CRUD complet — créer, modifier, supprimer des événements.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, Pencil, Trash2, Cake, Skull, Heart, AlertCircle } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { listAllEvents, createEvent, updateEvent, deleteEvent } from '@/database/repositories/eventRepo'
import { getAllPeople } from '@/database/repositories/personRepo'
import { listAllUnions, listAllUnionPartners } from '@/database/repositories/unionRepo'
import type { GeneEventView, EventType, PersonDated, UnionFamily } from '@/types'
import { EVENT_TYPE_LABELS } from '@/types'
import { displayName } from '@/lib/names'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const EVENT_ICONS: Record<string, typeof Cake> = {
  bapteme: Cake,
  confirmation: AlertCircle,
  mariage: Heart,
  divorce: AlertCircle,
  separation: AlertCircle,
  deces: Skull,
  inhumation: Skull,
  personnalise: CalendarDays,
}

const EVENT_COLORS: Record<string, string> = {
  bapteme: 'bg-blue-500',
  confirmation: 'bg-purple-500',
  mariage: 'bg-rose-500',
  divorce: 'bg-orange-500',
  separation: 'bg-yellow-500',
  deces: 'bg-destructive',
  inhumation: 'bg-gray-500',
  personnalise: 'bg-primary',
}

interface EventFormState {
  open: boolean
  editEvent?: GeneEventView
}

interface FormValues {
  type: EventType
  type_label: string
  person_id: string
  union_id: string
  date_qualifier: string
  date_d1: string
  date_d2: string
  place: string
  description: string
}

const EMPTY_FORM: FormValues = {
  type: 'personnalise',
  type_label: '',
  person_id: '',
  union_id: '',
  date_qualifier: 'exact',
  date_d1: '',
  date_d2: '',
  place: '',
  description: '',
}

export function EventsPage() {
  const project = useActiveProject()
  const navigate = useNavigate()
  const [events, setEvents] = useState<GeneEventView[]>([])
  const [people, setPeople] = useState<PersonDated[]>([])
  const [unions, setUnions] = useState<UnionFamily[]>([])
  const [unionPartners, setUnionPartners] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<EventFormState>({ open: false })
  const [values, setValues] = useState<FormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<GeneEventView | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const reload = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      const [evts, pps, uns, partners] = await Promise.all([
        listAllEvents(project.id),
        getAllPeople(project.id),
        listAllUnions(project.id),
        listAllUnionPartners(project.id),
      ])
      setEvents(evts)
      setPeople(pps)
      setUnions(uns)
      setUnionPartners(partners.reduce((m, p) => {
        const list = m.get(p.union_id) ?? []
        list.push(p.person_id)
        m.set(p.union_id, list)
        return m
      }, new Map<string, string[]>()))
    } finally {
      setLoading(false)
    }
  }, [project])

  useEffect(() => { reload() }, [reload])

  function openCreate() {
    setValues(EMPTY_FORM)
    setForm({ open: true })
  }

  function openEdit(ev: GeneEventView) {
    setValues({
      type: ev.type,
      type_label: ev.type_label,
      person_id: ev.person_id ?? '',
      union_id: ev.union_id ?? '',
      date_qualifier: ev.date?.qualifier ?? 'exact',
      date_d1: ev.date?.d1 ?? '',
      date_d2: ev.date?.d2 ?? '',
      place: ev.place,
      description: ev.description,
    })
    setForm({ open: true, editEvent: ev })
  }

  async function handleSave() {
    if (!project) return
    setSaving(true)
    try {
      const hasDate = values.date_d1.trim() || values.date_qualifier === 'unknown'
      const input = {
        type: values.type,
        type_label: values.type_label,
        person_id: values.person_id || null,
        union_id: values.union_id || null,
        date: hasDate ? { qualifier: values.date_qualifier as any, d1: values.date_d1, d2: values.date_d2 } : null,
        place: values.place,
        description: values.description,
      }
      if (form.editEvent) {
        await updateEvent(project.id, form.editEvent.id, input)
        toast.success('Événement modifié')
      } else {
        await createEvent(project.id, input)
        toast.success('Événement créé')
      }
      setForm({ open: false })
      reload()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!project || !confirmDelete) return
    try {
      await deleteEvent(project.id, confirmDelete.id)
      toast.success('Événement supprimé')
      setConfirmDelete(null)
      reload()
    } catch (e) {
      toast.error(String(e))
    }
  }

  function unionLabel(unionId: string): string {
    const partners = unionPartners.get(unionId) ?? []
    const names = partners.map((pid) => {
      const p = people.find((x) => x.id === pid)
      return p ? displayName(p) : '?'
    })
    return names.join(' & ') || 'Union'
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Événements"
        subtitle={`${events.length} événement(s) enregistré(s)`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Nouvel événement
          </Button>
        }
      />
      <div className="border-b px-4 py-2">
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Tous
          </Button>
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
            <Button
              key={t}
              variant={filter === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(t)}
            >
              {EVENT_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <CalendarDays className="size-4 animate-pulse" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {events.length === 0
              ? 'Aucun événement. Créez le premier avec le bouton ci-dessus.'
              : 'Aucun événement pour ce filtre.'}
          </div>
        ) : (
          <ol className="relative ml-3 border-l">
            {filtered.map((ev) => {
              const Icon = EVENT_ICONS[ev.type] ?? CalendarDays
              const color = EVENT_COLORS[ev.type] ?? 'bg-primary'
              const personLabel = ev.person_id
                ? people.find((p) => p.id === ev.person_id)
                  ? displayName(people.find((p) => p.id === ev.person_id)!)
                  : 'Personne supprimée'
                : null
              return (
                <li key={ev.id} className="group mb-4 ml-6">
                  <span className={cn(
                    'absolute -left-[7px] mt-1 flex size-3.5 items-center justify-center rounded-full ring-4 ring-background',
                    color,
                  )}>
                    <Icon className="size-2 text-white" />
                  </span>
                  <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {ev.date?.label ?? (ev.type_label || EVENT_TYPE_LABELS[ev.type])}
                        </div>
                        <div className="mt-0.5 text-sm font-medium">
                          {ev.type_label || EVENT_TYPE_LABELS[ev.type]}
                        </div>
                        {personLabel && (
                          <button
                            onClick={() => navigate(`/people/${ev.person_id}`)}
                            className="mt-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            {personLabel}
                          </button>
                        )}
                        {ev.union_id && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Union : {unionLabel(ev.union_id)}
                          </div>
                        )}
                        {ev.place && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {ev.place}
                          </div>
                        )}
                        {ev.description && (
                          <p className="mt-1 text-xs text-muted-foreground italic">{ev.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(ev)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(ev)}>
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Dialog création / édition */}
      <Dialog open={form.open} onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.editEvent ? 'Modifier l\'événement' : 'Nouvel événement'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type d'événement</Label>
                <Select value={values.type} onValueChange={(v) => setValues((s) => ({ ...s, type: v as EventType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
                      <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Libellé personnalisé</Label>
                <Input
                  placeholder="(optionnel)"
                  value={values.type_label}
                  onChange={(e) => setValues((s) => ({ ...s, type_label: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Personne associée</Label>
                <Select value={values.person_id} onValueChange={(v) => setValues((s) => ({ ...s, person_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{displayName(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Union associée</Label>
                <Select value={values.union_id} onValueChange={(v) => setValues((s) => ({ ...s, union_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune</SelectItem>
                    {unions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{unionLabel(u.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Qualificateur</Label>
                <Select value={values.date_qualifier} onValueChange={(v) => setValues((s) => ({ ...s, date_qualifier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Date exacte</SelectItem>
                    <SelectItem value="about">Vers</SelectItem>
                    <SelectItem value="before">Avant</SelectItem>
                    <SelectItem value="after">Après</SelectItem>
                    <SelectItem value="between">Entre</SelectItem>
                    <SelectItem value="unknown">Inconnue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  placeholder="JJ/MM/AAAA"
                  value={values.date_d1}
                  onChange={(e) => setValues((s) => ({ ...s, date_d1: e.target.value }))}
                />
              </div>
              {values.date_qualifier === 'between' && (
                <div>
                  <Label>Date fin</Label>
                  <Input
                    placeholder="JJ/MM/AAAA"
                    value={values.date_d2}
                    onChange={(e) => setValues((s) => ({ ...s, date_d2: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Lieu</Label>
              <Input
                placeholder="Ville, Pays"
                value={values.place}
                onChange={(e) => setValues((s) => ({ ...s, place: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Notes ou détails…"
                rows={2}
                value={values.description}
                onChange={(e) => setValues((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm({ open: false })}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : form.editEvent ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'événement sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
