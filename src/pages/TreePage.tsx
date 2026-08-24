// ---------------------------------------------------------------------------
// Page Arbre : canvas React Flow + contrôle de l'expansion et de la racine.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { ArrowDown, ArrowUp, Expand, FileImage, FileText, Printer, Shrink, TreePine } from 'lucide-react'
import { useActiveProject } from '@/stores/projectStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { TreeCanvas } from '@/components/tree/TreeCanvas'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { useTreeData } from '@/features/tree/useTreeData'
import type { TreeDirection } from '@/features/tree/layout'
import { getAllPeople } from '@/database/repositories/personRepo'
import { listAllUnions, listAllUnionPartners } from '@/database/repositories/unionRepo'
import { exportElementToPdf, exportElementToPng, printElement } from '@/lib/export'
import type { PersonDated } from '@/types'
import { displayName } from '@/lib/names'
import { toast } from 'sonner'

function rootKey(projectId: string) {
  return `ft.tree.root.${projectId}`
}

export function TreePage() {
  const project = useActiveProject()
  const navigate = useNavigate()
  const treeRef = useRef<HTMLDivElement>(null)
  const [people, setPeople] = useState<PersonDated[]>([])
  const [unionIds, setUnionIds] = useState<string[]>([])
  const [unionsOfPerson, setUnionsOfPerson] = useState<Map<string, string[]>>(new Map())
  const [rootId, setRootId] = useState<string>('')
  const [expandedUnions, setExpandedUnions] = useState<Set<string>>(new Set())
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [direction, setDirection] = useState<TreeDirection>('descendant')

  useEffect(() => {
    if (!project) return
    let alive = true
    ;(async () => {
      try {
        const [pps, unions, partners] = await Promise.all([
          getAllPeople(project.id),
          listAllUnions(project.id),
          listAllUnionPartners(project.id),
        ])
        if (!alive) return
        setPeople(pps)
        setUnionIds(unions.map((u) => u.id))
        const map = new Map<string, string[]>()
        for (const p of partners) {
          const list = map.get(p.person_id) ?? []
          if (!list.includes(p.union_id)) list.push(p.union_id)
          map.set(p.person_id, list)
        }
        setUnionsOfPerson(map)
        const stored = localStorage.getItem(rootKey(project.id))
        const valid = pps.some((p) => p.id === stored)
        setRootId(valid ? (stored ?? '') : pps[0]?.id ?? '')
      } catch {
        /* sans Tauri, on laisse vide */
      }
    })()
    return () => {
      alive = false
    }
  }, [project])

  useEffect(() => {
    if (rootId && project) {
      try {
        localStorage.setItem(rootKey(project.id), rootId)
      } catch {
        /* ignore */
      }
    }
  }, [rootId, project])

  const setRoot = useCallback((id: string) => {
    setRootId(id)
    setExpandedUnions(new Set())
    setExpandedParents(new Set())
  }, [])

  const expandPerson = useCallback(
    (personId: string) => {
      const uids = unionsOfPerson.get(personId) ?? []
      if (!uids.length) return
      setExpandedUnions((prev) => {
        const next = new Set(prev)
        for (const u of uids) next.add(u)
        return next
      })
    },
    [unionsOfPerson],
  )

  const collapsePerson = useCallback(
    (personId: string) => {
      const uids = unionsOfPerson.get(personId) ?? []
      if (!uids.length) return
      setExpandedUnions((prev) => {
        const next = new Set(prev)
        for (const u of uids) next.delete(u)
        return next
      })
    },
    [unionsOfPerson],
  )

  const expandAll = useCallback(() => setExpandedUnions(new Set(unionIds)), [unionIds])

  const collapseAll = useCallback(() => {
    setExpandedUnions(new Set())
    setExpandedParents(new Set())
  }, [])

  const toggleParents = useCallback((personId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }, [])

  const openPerson = useCallback((personId: string) => navigate(`/people/${personId}`), [navigate])

  async function handleExportPdf() {
    if (!treeRef.current || !rootLabel) return
    try {
      await exportElementToPdf(treeRef.current, `Arbre_${displayName(rootLabel)}`)
      toast.success('PDF exporté')
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function handleExportPng() {
    if (!treeRef.current || !rootLabel) return
    try {
      await exportElementToPng(treeRef.current, `Arbre_${displayName(rootLabel)}`)
      toast.success('Image exportée')
    } catch (e) {
      toast.error(String(e))
    }
  }

  function handlePrint() {
    if (!treeRef.current) return
    printElement(treeRef.current)
  }

  const { loading, error, layout } = useTreeData(project?.id ?? '', rootId, expandedUnions, expandedParents, direction)

  const rootLabel = useMemo(() => people.find((p) => p.id === rootId), [people, rootId])

  if (!project) {
    return (
      <div>
        <PageHeader title="Arbre" />
        <div className="flex-1 p-10 text-center text-sm text-muted-foreground">
          Sélectionnez ou créez un projet pour afficher un arbre.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Arbre généalogique"
        subtitle={rootLabel ? `Racine : ${displayName(rootLabel)}` : undefined}
        actions={
          <>
            <div className="w-56">
              <Select value={rootId} onValueChange={setRoot}>
                <SelectTrigger>
                  {rootLabel ? displayName(rootLabel) : 'Personne racine…'}
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{displayName(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" title="Tout développer" onClick={expandAll}>
              <Expand className="size-4" />
            </Button>
            <Button variant="outline" size="sm" title="Tout réduire" onClick={collapseAll}>
              <Shrink className="size-4" />
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex gap-1 rounded-lg border p-0.5">
              <Button
                variant={direction === 'descendant' ? 'default' : 'outline'}
                size="sm"
                title="Vue descendants"
                onClick={() => { setDirection('descendant'); setExpandedUnions(new Set()); setExpandedParents(new Set()) }}
              >
                <ArrowDown className="size-4" /> Descendants
              </Button>
              <Button
                variant={direction === 'ancestor' ? 'default' : 'outline'}
                size="sm"
                title="Vue ascendants"
                onClick={() => { setDirection('ancestor'); setExpandedUnions(new Set()); setExpandedParents(new Set()) }}
              >
                <ArrowUp className="size-4" /> Ascendants
              </Button>
            </div>
            <div className="h-6 w-px bg-border" />
            <Button variant="outline" size="sm" title="Exporter en PDF" onClick={handleExportPdf}>
              <FileText className="size-4" />
            </Button>
            <Button variant="outline" size="sm" title="Exporter en image" onClick={handleExportPng}>
              <FileImage className="size-4" />
            </Button>
            <Button variant="outline" size="sm" title="Imprimer" onClick={handlePrint}>
              <Printer className="size-4" />
            </Button>
          </>
        }
      />

      {error && (
        <div className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">{error}</div>
      )}
      <div className="relative min-h-0 flex-1" ref={treeRef}>
        {!loading ? (
          <ReactFlowProvider>
            <TreeCanvas
              key={rootId}
              layout={layout}
              initialCenterId={rootId}
              expandPerson={expandPerson}
              collapsePerson={collapsePerson}
              openPerson={openPerson}
              toggleParents={toggleParents}
            />
          </ReactFlowProvider>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <TreePine className="mr-2 size-4 animate-pulse" />
            Chargement de l’arbre…
          </div>
        )}
        {!loading && !layout.nodes.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
              Ajoutez des personnes pour commencer votre arbre.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}