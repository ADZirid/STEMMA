// ---------------------------------------------------------------------------
// Jeu de démonstration : famille multi-générations, unions multiples,
// demi-frères/sœurs et belles-familles. 100% fictif, créé localement.
// ---------------------------------------------------------------------------
import { useProjectStore, type ProjectInfo } from '@/stores/projectStore'
import { createPerson, type PersonInput } from '@/database/repositories/personRepo'
import { createUnion } from '@/database/repositories/unionRepo'
import { createSource } from '@/database/repositories/sourceRepo'

type Names = { given: string; surname: string }

const P = (given: string, surname: string): Names => ({ given, surname })

function person(
  n: Names,
  sex: PersonInput['sex'],
  opts: Partial<PersonInput> = {},
): PersonInput {
  return {
    given_name: n.given,
    surname: n.surname,
    birth_name: '',
    sex,
    profession: '',
    description: '',
    notes: '',
    ...opts,
  }
}

export async function seedDemoProject(): Promise<ProjectInfo> {
  const project = await useProjectStore.getState().createProject('Ma famille (démo)')
  const id = project.id

  const henri = await createPerson(id, person(P('Henri', 'Martin'), 'M', {
    birth: { date: { qualifier: 'exact', d1: '15/03/1898', d2: '' }, place: 'Tours' },
    death: { date: { qualifier: 'exact', d1: '02/11/1974', d2: '' }, place: 'Tours' },
    profession: 'Notaire',
    description: 'Souche de la famille Martin.',
    notes: 'Décoré pendant la Première Guerre mondiale.',
  }))

  const elise = await createPerson(id, person(P('Élise', 'Fontaine'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '21/07/1902', d2: '' }, place: 'Blois' },
    death: { date: { qualifier: 'exact', d1: '09/05/1981', d2: '' }, place: 'Tours' },
    profession: 'Sage-femme',
  }))

  const pierre = await createPerson(id, person(P('Pierre', 'Martin'), 'M', {
    birth: { date: { qualifier: 'exact', d1: '12/04/1925', d2: '' }, place: 'Tours' },
    death: { date: { qualifier: 'exact', d1: '30/08/2001', d2: '' }, place: 'Tours' },
    profession: 'Instituteur',
  }))

  const jeanne = await createPerson(id, person(P('Jeanne', 'Petit'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '08/02/1927', d2: '' }, place: 'Amboise' },
    death: { date: { qualifier: 'exact', d1: '14/12/1994', d2: '' }, place: 'Tours' },
  }))

  const claire = await createPerson(id, person(P('Claire', 'Bernard'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '19/06/1931', d2: '' }, place: 'Loches' },
    death: { date: { qualifier: 'exact', d1: '22/01/2010', d2: '' }, place: 'Tours' },
  }))

  const luc = await createPerson(id, person(P('Luc', 'Martin'), 'M', {
    birth: { date: { qualifier: 'exact', d1: '03/09/1950', d2: '' }, place: 'Tours' },
    profession: 'Charpentier',
  }))

  const anne = await createPerson(id, person(P('Anne', 'Martin'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '27/11/1953', d2: '' }, place: 'Tours' },
    profession: 'Bibliothécaire',
  }))

  const sophie = await createPerson(id, person(P('Sophie', 'Martin'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '05/05/1970', d2: '' }, place: 'Tours' },
    profession: 'Architecte',
  }))

  const nadia = await createPerson(id, person(P('Nadia', 'Moreau'), 'F', {
    birth: { date: { qualifier: 'about', d1: '1955', d2: '' }, place: 'Orléans' },
  }))

  const tom = await createPerson(id, person(P('Tom', 'Martin'), 'M', {
    birth: { date: { qualifier: 'exact', d1: '14/02/1980', d2: '' }, place: 'Tours' },
    profession: 'Boulanger',
  }))

  const lily = await createPerson(id, person(P('Lily', 'Martin'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '30/06/1983', d2: '' }, place: 'Tours' },
  }))

  const marc = await createPerson(id, person(P('Marc', 'Robin'), 'M', {
    birth: { date: { qualifier: 'about', d1: '1948', d2: '' }, place: 'Paris' },
  }))

  const emma = await createPerson(id, person(P('Emma', 'Robin'), 'F', {
    birth: { date: { qualifier: 'about', d1: '1985', d2: '' }, place: 'Tours' },
  }))

  const camille = await createPerson(id, person(P('Camille', 'Lambert'), 'F', {
    birth: { date: { qualifier: 'exact', d1: '1982', d2: '' }, place: 'Tours' },
    profession: 'Enseignante',
  }))

  // ---- Unions -------------------------------------------------------------
  await createUnion(id, {
    type: 'mariage', status: 'passe', place: 'Tours',
    start: { date: { qualifier: 'exact', d1: '1923', d2: '' } }, end: { date: { qualifier: 'exact', d1: '1974', d2: '' } },
    partner_ids: [henri, elise],
    children: [{ child_id: pierre, relationship_type: 'biologique' }],
  })

  await createUnion(id, {
    type: 'mariage', status: 'passe', place: 'Amboise',
    start: { date: { qualifier: 'exact', d1: '1948', d2: '' } }, end: { date: { qualifier: 'exact', d1: '1994', d2: '' } },
    partner_ids: [pierre, jeanne],
    children: [
      { child_id: luc, relationship_type: 'biologique' },
      { child_id: anne, relationship_type: 'biologique' },
    ],
  })

  await createUnion(id, {
    type: 'mariage', status: 'passe', place: 'Loches',
    start: { date: { qualifier: 'exact', d1: '1966', d2: '' } }, end: { date: { qualifier: 'exact', d1: '1988', d2: '' } },
    partner_ids: [pierre, claire],
    notes: 'Remariage de Pierre après le décès de Jeanne.',
    children: [{ child_id: sophie, relationship_type: 'biologique' }],
  })

  await createUnion(id, {
    type: 'mariage', status: 'actuel', place: 'Tours',
    start: { date: { qualifier: 'exact', d1: '1978', d2: '' } },
    partner_ids: [luc, nadia],
    children: [
      { child_id: tom, relationship_type: 'biologique' },
      { child_id: lily, relationship_type: 'biologique' },
    ],
  })

  await createUnion(id, {
    type: 'union', status: 'separe', place: 'Tours',
    start: { date: { qualifier: 'about', d1: '1980', d2: '' } }, end: { date: { qualifier: 'about', d1: '1984', d2: '' } },
    partner_ids: [anne, marc],
    children: [{ child_id: emma, relationship_type: 'biologique' }],
  })

  await createUnion(id, {
    type: 'union', status: 'actuel', place: 'Tours',
    start: { date: { qualifier: 'about', d1: '2005', d2: '' } },
    partner_ids: [tom, camille],
  })

  // ---- Source -------------------------------------------------------------
  await createSource(id, {
    title: 'Registre des naissances — Tours 1898',
    author: 'Archives municipales de Tours',
    date: '1898',
    archive: 'Archives municipales de Tours',
    reference: '1E/1898/014',
    url: '',
    comment: 'Acte de naissance d’Henri.',
  })

  return project
}