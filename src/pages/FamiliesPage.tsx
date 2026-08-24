// ---------------------------------------------------------------------------
// Page Familles : toutes les unions du projet, filtrables.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { Plus, HeartHandshake } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { UnionCard } from '@/components/family/UnionCard'
import { UnionFormDialog } from '@/components/family/UnionFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listAllUnionViews } from '@/database/repositories/unionRepo'
import { getAllPeople } from '@/database/repositories/personRepo'
import type { PersonDated, UnionView } from '@/types'
import { displayName } from '@/lib/names'

export function FamiliesPage() {
  const project = useActiveProject()
  const [views, setViews] = useState<UnionView[]>([])
  const [people, setPeople] = useState<PersonDated[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ open: boolean; editUnion?: UnionView }>({ open: false })

  const reload = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      const [vs, ps] = await Promise.all([listAllUnionViews(project.id), getAllPeople(project.id)])
      setViews(vs)
      setPeople(ps)
    } finally {
      setLoading(false)
    }
  }, [project])

  useEffect(() => {
    reload()
  }, [reload])

  const filtered = views.filter((v) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const text = [
      ...v.partners.map((p) => displayName(p)),
      ...v.children.map((c) => displayName(c.person)),
      v.union.place,
    ].join(' ').toLowerCase()
    return text.includes(q)
  })

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Familles"
        subtitle={`${views.length} union${views.length > 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setForm({ open: true })}>
            <Plus className="size-4" /> Nouvelle union
          </Button>
        }
      />
      <div className="border-b px-4 py-3">
        <Input
          placeholder="Rechercher par partenaire, enfant ou lieu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartHandshake className="size-4 animate-pulse" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {search ? 'Aucune union ne correspond.' : 'Aucune union pour le moment.'}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((v) => (
              <UnionCard
                key={v.union.id}
                view={v}
                people={people.map((p) => ({ id: p.id, given_name: p.given_name, surname: p.surname }))}
                onChanged={reload}
                onEdit={() => setForm({ open: true, editUnion: v })}
              />
            ))}
          </div>
        )}
      </div>

      <UnionFormDialog
        open={form.open}
        onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
        unionId={form.editUnion?.union.id}
        view={form.editUnion}
        people={people.map((p) => ({ id: p.id, label: displayName(p) }))}
        onSaved={reload}
      />
    </div>
  )
}