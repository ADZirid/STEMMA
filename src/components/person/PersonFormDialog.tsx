// ---------------------------------------------------------------------------
// Formulaire d'une personne (création / édition) — fiche complète.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DateField, type DateFieldValue } from './DateField'
import type { PersonDated, DateQualifier } from '@/types'
import { useActiveProject } from '@/stores/projectStore'
import { createPerson, updatePerson, type PersonInput } from '@/database/repositories/personRepo'
import { toast } from 'sonner'

export function PersonFormDialog({
  open,
  onOpenChange,
  person,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  person?: PersonDated | null
  onSaved: (id: string) => void
}) {
  const project = useActiveProject()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    given_name: '',
    surname: '',
    birth_name: '',
    sex: 'X' as PersonDated['sex'],
    profession: '',
    description: '',
    notes: '',
    photo_id: '',
  })
  const [birth, setBirth] = useState<DateFieldValue>({ qualifier: 'unknown' as DateQualifier, d1: '', d2: '' })
  const [birthPlace, setBirthPlace] = useState('')
  const [death, setDeath] = useState<DateFieldValue>({ qualifier: 'unknown' as DateQualifier, d1: '', d2: '' })
  const [deathPlace, setDeathPlace] = useState('')

  useEffect(() => {
    if (open) {
      setForm({
        given_name: person?.given_name ?? '',
        surname: person?.surname ?? '',
        birth_name: person?.birth_name ?? '',
        sex: person?.sex ?? 'X',
        profession: person?.profession ?? '',
        description: person?.description ?? '',
        notes: person?.notes ?? '',
        photo_id: person?.photo_id ?? '',
      })
      setBirth(
        person?.birth?.date
          ? { qualifier: person.birth.date.qualifier, d1: person.birth.date.d1, d2: person.birth.date.d2 }
          : { qualifier: 'unknown', d1: '', d2: '' },
      )
      setBirthPlace(person?.birth?.place ?? '')
      setDeath(
        person?.death?.date
          ? { qualifier: person.death.date.qualifier, d1: person.death.date.d1, d2: person.death.date.d2 }
          : { qualifier: 'unknown', d1: '', d2: '' },
      )
      setDeathPlace(person?.death?.place ?? '')
    }
  }, [open, person])

  async function submit() {
    if (!project) return
    if (!form.given_name.trim() && !form.surname.trim()) {
      toast.error('Prénom ou nom requis')
      return
    }
    setSaving(true)
    const input: PersonInput = {
      ...form,
      birth: {
        date: birth,
        place: birthPlace,
      },
      death: {
        date: death,
        place: deathPlace,
      },
    }
    try {
      const id = person ? person.id : await createPerson(project.id, input)
      if (person) await updatePerson(project.id, person.id, input)
      toast.success(person ? 'Personne modifiée' : 'Personne créée')
      onOpenChange(false)
      onSaved(person ? person.id : id)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{person ? 'Modifier la personne' : 'Nouvelle personne'}</DialogTitle>
          <DialogDescription>
            Toutes les données restent sur votre ordinateur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Prénom(s)</Label>
              <Input
                value={form.given_name}
                onChange={(e) => setForm({ ...form, given_name: e.target.value })}
                placeholder="Jean"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Nom</Label>
              <Input
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Nom de naissance</Label>
              <Input
                value={form.birth_name}
                onChange={(e) => setForm({ ...form, birth_name: e.target.value })}
                placeholder="si différent"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Sexe</Label>
              <Select value={form.sex} onValueChange={(s) => setForm({ ...form, sex: s as PersonDated['sex'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                  <SelectItem value="X">Autre / inconnu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DateField label="Naissance" value={birth} onChange={setBirth} />
            <div className="grid gap-1.5">
              <Label className="text-xs">Lieu de naissance</Label>
              <Input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="Ville"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DateField label="Décès" value={death} onChange={setDeath} />
            <div className="grid gap-1.5">
              <Label className="text-xs">Lieu de décès</Label>
              <Input
                value={deathPlace}
                onChange={(e) => setDeathPlace(e.target.value)}
                placeholder="Ville"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Profession</Label>
            <Input
              value={form.profession}
              onChange={(e) => setForm({ ...form, profession: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement…' : person ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}