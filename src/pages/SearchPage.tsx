// ---------------------------------------------------------------------------
// Page Recherche : recherche multi-entités avec filtres par catégorie.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, HeartHandshake, ScrollText, CalendarDays } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PersonCard } from '@/components/person/PersonCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchAll, searchByCategory, type SearchResult, type SearchCategory } from '@/features/search/searchRepo'
import type { Source, GeneEventView } from '@/types'

const CATEGORIES: { key: SearchCategory | 'all'; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'Tout', icon: Search },
  { key: 'person', label: 'Personnes', icon: Users },
  { key: 'union', label: 'Familles', icon: HeartHandshake },
  { key: 'source', label: 'Sources', icon: ScrollText },
  { key: 'event', label: 'Événements', icon: CalendarDays },
]

function UnionResultCard({ result }: { result: SearchResult }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <HeartHandshake className="size-4 shrink-0 text-primary" />
        <span className="text-sm font-medium">{result.title}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{result.subtitle}</div>
    </div>
  )
}

function SourceResultCard({ result }: { result: SearchResult }) {
  const s = result.data as Source
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <ScrollText className="size-4 shrink-0 text-amber-600" />
        <span className="text-sm font-medium">{result.title}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{result.subtitle}</div>
      {s.comment && <div className="mt-1 text-xs text-muted-foreground italic truncate">{s.comment}</div>}
    </div>
  )
}

function EventResultCard({ result }: { result: SearchResult }) {
  const navigate = useNavigate()
  const ev = result.data as GeneEventView
  return (
    <button
      onClick={() => ev.person_id && navigate(`/people/${ev.person_id}`)}
      className="w-full rounded-xl border bg-card p-3 text-left shadow-sm hover:border-primary/50 transition"
    >
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 shrink-0 text-rose-500" />
        <span className="text-sm font-medium">{result.title}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{result.subtitle}</div>
    </button>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  const navigate = useNavigate()
  switch (result.category) {
    case 'person':
      return (
        <PersonCard
          person={result.data as any}
          onClick={() => navigate(`/people/${result.id}`)}
        />
      )
    case 'union':
      return <UnionResultCard result={result} />
    case 'source':
      return <SourceResultCard result={result} />
    case 'event':
      return <EventResultCard result={result} />
    default:
      return null
  }
}

export function SearchPage() {
  const project = useActiveProject()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SearchCategory | 'all'>('all')

  const run = useCallback(
    async (term: string, cat: SearchCategory | 'all') => {
      if (!project) return
      setLoading(true)
      try {
        const res = cat === 'all'
          ? await searchAll(project.id, term)
          : await searchByCategory(project.id, term, cat)
        setResults(res)
        setSearched(true)
      } finally {
        setLoading(false)
      }
    },
    [project],
  )

  useEffect(() => {
    if (q.trim().length >= 2) {
      const t = setTimeout(() => run(q, activeCategory), 250)
      return () => clearTimeout(t)
    }
    setResults([])
    setSearched(false)
  }, [q, activeCategory, run])

  const categoryCounts = results.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (!project) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Aucun projet actif.</div>
  }

  const showResults = searched && q.trim().length >= 2

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Recherche" subtitle={`Projet : ${project.name}`} />
      <div className="border-b px-4 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Nom, lieu, source, événement…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="flex gap-1 border-b px-4 py-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const count = cat.key === 'all' ? results.length : (categoryCounts[cat.key] ?? 0)
          return (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat.key)}
              className="gap-1.5"
            >
              <Icon className="size-3" />
              {cat.label}
              {showResults && count > 0 && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] font-medium">
                  {count}
                </span>
              )}
            </Button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && <div className="text-sm text-muted-foreground">Recherche…</div>}
        {showResults && !loading && (
          <>
            <div className="mb-3 text-xs text-muted-foreground">
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </div>
            {results.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Aucun résultat.</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {results.map((r) => (
                  <ResultCard key={`${r.category}-${r.id}`} result={r} />
                ))}
              </div>
            )}
          </>
        )}
        {!searched && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Tapez au moins 2 caractères pour lancer la recherche.
          </div>
        )}
      </div>
    </div>
  )
}
