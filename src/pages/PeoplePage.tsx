// ---------------------------------------------------------------------------
// Page Personnes : liste paginée avec recherche et création.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PersonCard } from '@/components/person/PersonCard'
import { PersonFormDialog } from '@/components/person/PersonFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listPeople } from '@/database/repositories/personRepo'
import type { PersonDated } from '@/types'

const PAGE = 50

export function PeoplePage() {
  const project = useActiveProject()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<PersonDated[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [formOpen, setFormOpen] = useState(Boolean(params.get('new')))

  const reload = useCallback(
    async (offset = 0) => {
      if (!project) return
      setLoading(true)
      try {
        const res = await listPeople(project.id, { search, limit: PAGE, offset })
        setRows(res.rows)
        setTotal(res.total)
      } finally {
        setLoading(false)
      }
    },
    [project, search],
  )

  useEffect(() => {
    reload(0)
  }, [reload])

  useEffect(() => {
    if (formOpen) {
      const p = new URLSearchParams(params)
      p.delete('new')
      setParams(p, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen])

  const onSaved = useCallback((id: string) => {
    reload(0)
    navigate(`/people/${id}`)
  }, [navigate, reload])

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Personnes"
        subtitle={`${total} personne${total > 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Nouvelle personne
          </Button>
        }
      />
      <div className="border-b px-4 py-3">
        <Input
          placeholder="Rechercher un nom…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            const p = new URLSearchParams(params)
            if (e.target.value) p.set('q', e.target.value)
            else p.delete('q')
            setParams(p, { replace: true })
          }}
          className="max-w-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 animate-pulse" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {search ? 'Aucun résultat.' : 'Aucune personne. Créez votre première personne.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {rows.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                onClick={() => navigate(`/people/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <PersonFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={onSaved} />
    </div>
  )
}