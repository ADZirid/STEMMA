// ---------------------------------------------------------------------------
// Fiche personne : identité, dates, parents, unions, enfants, fratrie.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, FileImage, Pencil, Printer, Trash2, Plus, HeartHandshake, Users, UserRound, CalendarDays, Link } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PersonCard } from '@/components/person/PersonCard'
import { PersonFormDialog } from '@/components/person/PersonFormDialog'
import { UnionCard } from '@/components/family/UnionCard'
import { UnionFormDialog } from '@/components/family/UnionFormDialog'
import { PhotoDisplay } from '@/components/media/PhotoDisplay'
import { MediaLinkDialog } from '@/components/media/MediaLinkDialog'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getPerson, softDeletePeople, getAllPeople } from '@/database/repositories/personRepo'
import { listPersonUnions } from '@/database/repositories/unionRepo'
import { listEventsByPerson } from '@/database/repositories/eventRepo'
import { getMediaForPerson } from '@/database/repositories/mediaRepo'
import { buildRelGraph, relationshipBetween, type RelGraph } from '@/features/tree/engine'
import type { PersonDated, UnionView, GeneEventView, Media } from '@/types'
import { EVENT_TYPE_LABELS } from '@/types'
import { displayName, nameWithYears } from '@/lib/names'
import { exportElementToPdf, exportElementToPng, printElement } from '@/lib/export'
import { toast } from 'sonner'

interface Relations {
  parents: string[]
  siblings: { id: string; half: boolean }[]
  children: string[]
  cousins: { id: string; label: string }[]
}

function extractRelations(g: RelGraph, personId: string): Relations {
  const parents = (g.parents.get(personId) ?? []).map((e) => e.parent_id)
  const mine = g.parents.get(personId)?.map((p) => p.parent_id) ?? []
  const siblings: { id: string; half: boolean }[] = []
  for (const otherId of g.parents.keys()) {
    if (otherId === personId) continue
    const theirs = g.parents.get(otherId)?.map((p) => p.parent_id) ?? []
    const common = mine.filter((p) => theirs.includes(p)).length
    if (common >= 2) siblings.push({ id: otherId, half: false })
    else if (common === 1) siblings.push({ id: otherId, half: true })
  }
  // Cousins : enfants de frères/sœurs des parents
  const cousins: { id: string; label: string }[] = []
  const parentSet = new Set(parents)
  const siblingIds = new Set(siblings.map((s) => s.id))
  for (const [otherId, otherParents] of g.parents.entries()) {
    if (otherId === personId) continue
    if (siblingIds.has(otherId)) continue
    // Un cousin est quelqu'un qui partage un ancêtre au niveau grand-parent
    // mais qui n'est ni un frère, ni un parent, ni un enfant
    const otherParentIds = otherParents.map((p) => p.parent_id)
    const sharedParents = otherParentIds.filter((p) => parentSet.has(p))
    if (sharedParents.length > 0) {
      // Vérifier que ce n'est pas un frère (déjà traité) ou un parent/enfant
      const isParent = parentSet.has(otherId)
      const isChild = g.children.get(personId)?.has(otherId)
      if (!isParent && !isChild) {
        const rel = relationshipBetween(g, personId, otherId)
        if (rel.kind === 'cousin') {
          cousins.push({ id: otherId, label: rel.from })
        }
      }
    }
  }
  return { parents, siblings, children: [...(g.children.get(personId) ?? [])], cousins }
}

export function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const project = useActiveProject()
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)
  const [person, setPerson] = useState<PersonDated | null>(null)
  const [people, setPeople] = useState<PersonDated[]>([])
  const [unions, setUnions] = useState<UnionView[]>([])
  const [events, setEvents] = useState<GeneEventView[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [relations, setRelations] = useState<Relations | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [unionForm, setUnionForm] = useState<{ open: boolean; editUnion?: UnionView }>({ open: false })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mediaLinkOpen, setMediaLinkOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!project || !id) return
    try {
      const [p, all, us, evts, meds, g] = await Promise.all([
        getPerson(project.id, id),
        getAllPeople(project.id),
        listPersonUnions(project.id, id),
        listEventsByPerson(project.id, id),
        getMediaForPerson(project.id, id),
        buildRelGraph(project.id),
      ])
      if (!p) {
        setPerson(null)
        return
      }
      setPerson(p)
      setPeople(all)
      setUnions(us)
      setEvents(evts)
      setMedia(meds)
      setRelations(extractRelations(g, id))
    } catch (e) {
      toast.error(String(e))
    }
  }, [project, id])

  useEffect(() => {
    reload()
  }, [reload])

  const personLabels = useMemo(
    () => people.map((p) => ({ id: p.id, label: displayName(p) })),
    [people],
  )

  async function handleExportPdf() {
    if (!printRef.current || !person) return
    try {
      await exportElementToPdf(printRef.current, `Fiche_${displayName(person)}`, { landscape: false })
      toast.success('PDF exporté')
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function handleExportPng() {
    if (!printRef.current || !person) return
    try {
      await exportElementToPng(printRef.current, `Fiche_${displayName(person)}`)
      toast.success('Image exportée')
    } catch (e) {
      toast.error(String(e))
    }
  }

  function handlePrint() {
    if (!printRef.current) return
    printElement(printRef.current)
  }

  async function removePerson() {
    if (!project || !id) return
    await softDeletePeople(project.id, [id])
    toast.success('Personne placée dans la corbeille')
    navigate('/people')
  }

  if (!id) return null

  if (!person) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Personne introuvable.
      </div>
    )
  }

  const placeInfo = [
    person.birth?.place ? `né(e) à ${person.birth.place}` : null,
    person.death?.place ? `décédé(e) à ${person.death.place}` : null,
    person.profession || null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={nameWithYears(person)}
        subtitle={placeInfo || undefined}
        backTo={
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} title="Retour">
            <ArrowLeft className="size-4" />
          </Button>
        }
        actions={
          <>
            <Button variant="outline" size="sm" title="Exporter en PDF" onClick={handleExportPdf}>
              <FileText className="size-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" title="Exporter en image" onClick={handleExportPng}>
              <FileImage className="size-4" />
            </Button>
            <Button variant="outline" size="sm" title="Imprimer" onClick={handlePrint}>
              <Printer className="size-4" />
            </Button>
            <div className="h-6 w-px bg-border" />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Modifier
            </Button>
            <Button
              variant="outline"
              onClick={() => setUnionForm({ open: true, editUnion: undefined })}
            >
              <Plus className="size-4" /> Nouvelle union
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
            <div className="h-6 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={() => setMediaLinkOpen(true)}>
              <Link className="size-4" /> Lier un média
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto" ref={printRef}>
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <PhotoDisplay
                  photoRelPath={person.photo_id || null}
                  givenName={person.given_name}
                  surname={person.surname}
                  size="lg"
                />
                <div className="flex-1">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <UserRound className="size-4" /> Identité
                  </h3>
                  <dl className="grid gap-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Prénom(s)</dt><dd>{person.given_name || '—'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Nom</dt><dd>{person.surname || '—'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Nom de naissance</dt><dd>{person.birth_name || '—'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Sexe</dt><dd>{person.sex || '—'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Profession</dt><dd>{person.profession || '—'}</dd></div>
                  </dl>
                </div>
              </div>
              {person.description && (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{person.description}</p>
              )}
            </div>

            {person.notes && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold">Notes</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{person.notes}</p>
              </div>
            )}

            {events.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4" /> Événements ({events.length})
                </h3>
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        {ev.date?.label ?? EVENT_TYPE_LABELS[ev.type]}
                      </span>
                      <span className="font-medium">{ev.type_label || EVENT_TYPE_LABELS[ev.type]}</span>
                      {ev.place && <span className="text-muted-foreground">— {ev.place}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {media.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Link className="size-4" /> Médias ({media.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {media.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="truncate">{m.original_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(m.size_bytes / 1024).toFixed(0)} Ko
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:col-span-2">
            {relations && relations.parents.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">Parents</h3>
                <div className="flex flex-wrap gap-2">
                  {relations.parents.map((pid) => {
                    const pp = people.find((x) => x.id === pid)
                    if (pp) {
                      return <PersonCard key={pid} person={pp} onClick={() => navigate(`/people/${pp.id}`)} />
                    }
                    // Parent supprimé mais encore lié
                    return (
                      <div key={pid} className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        <span className="italic">Personne supprimée</span>
                        <span className="text-xs">(id: {pid.slice(0, 8)}…)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {relations && relations.siblings.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4" /> Frères &amp; sœurs
                </h3>
                <div className="flex flex-wrap gap-2">
                  {relations.siblings.map((s) => {
                    const sp = people.find((x) => x.id === s.id)
                    return sp ? (
                      <PersonCard key={s.id} person={sp} muted={s.half} onClick={() => navigate(`/people/${sp.id}`)} />
                    ) : null
                  })}
                </div>
              </div>
            )}

            {relations && relations.cousins.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4" /> Cousins
                </h3>
                <div className="flex flex-wrap gap-2">
                  {relations.cousins.map((c) => {
                    const cp = people.find((x) => x.id === c.id)
                    return cp ? (
                      <PersonCard key={c.id} person={cp} onClick={() => navigate(`/people/${cp.id}`)} />
                    ) : null
                  })}
                </div>
              </div>
            )}

            {relations && relations.children.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4" /> Enfants ({relations.children.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {relations.children.map((c) => {
                    const cp = people.find((x) => x.id === c)
                    return cp ? (
                      <PersonCard key={c} person={cp} onClick={() => navigate(`/people/${cp.id}`)} />
                    ) : null
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <HeartHandshake className="size-4" /> Unions ({unions.length})
              </h3>
              <div className="space-y-3">
                {unions.map((v) => (
                  <UnionCard
                    key={v.union.id}
                    view={v}
                    people={people.map((p) => ({ id: p.id, given_name: p.given_name, surname: p.surname }))}
                    onChanged={reload}
                    onEdit={() => setUnionForm({ open: true, editUnion: v })}
                  />
                ))}
                {unions.length === 0 && (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Aucune union pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PersonFormDialog open={editOpen} onOpenChange={setEditOpen} person={person} onSaved={() => reload()} />
      <UnionFormDialog
        open={unionForm.open}
        onOpenChange={(o) => setUnionForm((s) => ({ ...s, open: o }))}
        unionId={unionForm.editUnion?.union.id}
        view={unionForm.editUnion}
        initialPartnerIds={id ? [id] : []}
        people={personLabels}
        onSaved={reload}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {displayName(person)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La personne passe dans la corbeille du projet (récupérable). Les unions et liens
              associés seront masqués.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removePerson}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaLinkDialog
        open={mediaLinkOpen}
        onOpenChange={setMediaLinkOpen}
        entityType="person"
        entityId={id}
        onLinked={reload}
      />
    </div>
  )
}