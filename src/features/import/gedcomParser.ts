// ---------------------------------------------------------------------------
// Parser GEDCOM 5.5.1 : analyse d'un fichier .ged en arbre de records.
// Format : https://gedcom.io/specs/5.5.1/
// ---------------------------------------------------------------------------

export interface GedcomLine {
  level: number
  tag: string
  value: string | null
  xref: string | null // @XREF@
}

export interface GedcomRecord {
  level: number
  tag: string
  value: string | null
  xref: string | null
  children: GedcomRecord[]
}

// ---------------------------------------------------------------------------
// Étape 1 : Parser brut — lignes → GedcomLine[]
// ---------------------------------------------------------------------------

export function parseGedcomLines(text: string): GedcomLine[] {
  const lines: GedcomLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (!line || line.startsWith('0 BOM')) continue

    // Format : LEVEL TAG [VALUE] ou LEVEL @XREF@ TAG [VALUE]
    const m1 = line.match(/^(\d+)\s+(@[^@]+@)\s+(\w+)(?:\s+(.+))?$/)
    if (m1) {
      lines.push({ level: parseInt(m1[1]), tag: m1[3], value: m1[4] ?? null, xref: m1[2] })
      continue
    }

    const m2 = line.match(/^(\d+)\s+(\w+)(?:\s+(.+))?$/)
    if (m2) {
      lines.push({ level: parseInt(m2[1]), tag: m2[2], value: m2[3] ?? null, xref: null })
      continue
    }
  }
  return lines
}

// ---------------------------------------------------------------------------
// Étape 2 : Arbre de records — GedcomLine[] → GedcomRecord[]
// ---------------------------------------------------------------------------

export function buildRecordTree(lines: GedcomLine[]): GedcomRecord[] {
  const root: GedcomRecord[] = []
  const stack: GedcomRecord[] = []

  for (const line of lines) {
    const record: GedcomRecord = {
      level: line.level,
      tag: line.tag,
      value: line.value,
      xref: line.xref,
      children: [],
    }

    // Remonter jusqu'au parent de niveau inférieur
    while (stack.length > 0 && stack[stack.length - 1].level >= line.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(record)
    } else {
      stack[stack.length - 1].children.push(record)
    }
    stack.push(record)
  }
  return root
}

// ---------------------------------------------------------------------------
// Étape 3 : Extraction des entités INDI / FAM
// ---------------------------------------------------------------------------

export interface GedcomName {
  given: string
  surname: string
  suffix: string
}

export interface GedcomDate {
  qualifier: string // ABT, BEF, AFT, BET, EST, exact
  date: string
}

export interface GedcomEvent {
  date: GedcomDate | null
  place: string
  type: string
}

export interface GedcomIndi {
  xref: string
  names: GedcomName[]
  sex: string
  birth: GedcomEvent | null
  death: GedcomEvent | null
  famc: string[] // familles où cet individu est enfant
  fams: string[] // familles où cet individu est partenaire
  notes: string[]
}

export interface GedcomFam {
  xref: string
  husb: string | null
  wife: string | null
  children: string[]
  marr: GedcomEvent | null
  div: GedcomEvent | null
}

export interface GedcomTree {
  head: { source: string; gedcomVersion: string }
  indi: Map<string, GedcomIndi>
  fam: Map<string, GedcomFam>
}

function parseName(raw: string): GedcomName {
  // Format : Given1 Given2 /Surname/ Suffix
  const m = raw.match(/^(.*?)\s*\/(.*?)\/\s*(.*)$/)
  if (m) {
    return { given: m[1].trim(), surname: m[2].trim(), suffix: m[3].trim() }
  }
  return { given: raw.trim(), surname: '', suffix: '' }
}

function parseGedcomDate(value: string | null): GedcomDate | null {
  if (!value) return null
  const v = value.trim()
  if (v.startsWith('ABT ')) return { qualifier: 'about', date: v.slice(4) }
  if (v.startsWith('BEF ')) return { qualifier: 'before', date: v.slice(4) }
  if (v.startsWith('AFT ')) return { qualifier: 'after', date: v.slice(4) }
  if (v.startsWith('EST ')) return { qualifier: 'about', date: v.slice(4) }
  if (v.startsWith('BET ')) return { qualifier: 'between', date: v }
  return { qualifier: 'exact', date: v }
}

function parseEvent(record: GedcomRecord): GedcomEvent {
  let date: GedcomDate | null = null
  let place = ''
  for (const child of record.children) {
    if (child.tag === 'DATE') date = parseGedcomDate(child.value)
    if (child.tag === 'PLAC') place = child.value ?? ''
  }
  return { date, place, type: record.tag }
}

function parseIndi(record: GedcomRecord): GedcomIndi {
  const indi: GedcomIndi = {
    xref: record.xref ?? '',
    names: [],
    sex: '',
    birth: null,
    death: null,
    famc: [],
    fams: [],
    notes: [],
  }
  for (const child of record.children) {
    switch (child.tag) {
      case 'NAME':
        indi.names.push(parseName(child.value ?? ''))
        break
      case 'SEX':
        indi.sex = child.value ?? ''
        break
      case 'BIRT':
        indi.birth = parseEvent(child)
        break
      case 'DEAT':
        indi.death = parseEvent(child)
        break
      case 'FAMC':
        if (child.value) indi.famc.push(child.value.replace(/@/g, ''))
        break
      case 'FAMS':
        if (child.value) indi.fams.push(child.value.replace(/@/g, ''))
        break
      case 'NOTE':
        indi.notes.push(child.value ?? '')
        break
    }
  }
  return indi
}

function parseFam(record: GedcomRecord): GedcomFam {
  const fam: GedcomFam = {
    xref: record.xref ?? '',
    husb: null,
    wife: null,
    children: [],
    marr: null,
    div: null,
  }
  for (const child of record.children) {
    switch (child.tag) {
      case 'HUSB':
        if (child.value) fam.husb = child.value.replace(/@/g, '')
        break
      case 'WIFE':
        if (child.value) fam.wife = child.value.replace(/@/g, '')
        break
      case 'CHIL':
        if (child.value) fam.children.push(child.value.replace(/@/g, ''))
        break
      case 'MARR':
        fam.marr = parseEvent(child)
        break
      case 'DIV':
        fam.div = parseEvent(child)
        break
    }
  }
  return fam
}

// ---------------------------------------------------------------------------
// Fonction principale : texte brut → GedcomTree
// ---------------------------------------------------------------------------

export function parseGedcom(text: string): GedcomTree {
  const lines = parseGedcomLines(text)
  const records = buildRecordTree(lines)

  const tree: GedcomTree = {
    head: { source: '', gedcomVersion: '5.5.1' },
    indi: new Map(),
    fam: new Map(),
  }

  for (const rec of records) {
    if (rec.tag === 'HEAD') {
      for (const child of rec.children) {
        if (child.tag === 'SOUR') tree.head.source = child.value ?? ''
        if (child.tag === 'GEDC') {
          const v = child.children.find((c) => c.tag === 'VERS')
          if (v) tree.head.gedcomVersion = v.value ?? '5.5.1'
        }
      }
    } else if (rec.tag === 'INDI') {
      const indi = parseIndi(rec)
      if (indi.xref) tree.indi.set(indi.xref, indi)
    } else if (rec.tag === 'FAM') {
      const fam = parseFam(rec)
      if (fam.xref) tree.fam.set(fam.xref, fam)
    }
  }

  return tree
}
