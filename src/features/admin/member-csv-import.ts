import { normalizeMemberPhone } from '#/shared/lib/phone'

/** Current membership year used for Bet. columns and members.paid sync. */
export const CURRENT_PAYMENT_YEAR = 2026
export const PREVIOUS_PAYMENT_YEAR = 2025

export const MEMBER_CSV_HEADERS = [
  'ID',
  'Fornavn',
  'Etternavn',
  'Adresse',
  'Postnr',
  'Poststed',
  'Mobil',
  'Epost',
  'Fødselsår',
  'Type',
  'Innmeldt',
  'Bet. 2026',
  'Bet. 25 i fjor',
] as const

export type MemberCsvHeader = (typeof MEMBER_CSV_HEADERS)[number]

export type MemberPaymentYear = {
  year: number
  paid: boolean
}

/** Normalized row ready for insert/update/compare. */
export type ParsedMemberCsvRow = {
  lineNumber: number
  externalId: string | null
  firstName: string
  lastName: string
  address: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  birthYear: number | null
  memberType: string | null
  joinedAt: string | null
  payments: MemberPaymentYear[]
  /** members.paid from CURRENT_PAYMENT_YEAR */
  paid: boolean
}

export type ExistingMemberForImport = {
  id: string
  external_id: string | null
  first_name: string
  last_name: string
  address: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  email: string | null
  birth_year: number | null
  member_type: string | null
  joined_at: string | null
  paid: boolean
  payments: MemberPaymentYear[]
}

export type MemberImportConflict = {
  existing: ExistingMemberForImport
  csv: ParsedMemberCsvRow
  differingFields: string[]
}

/** Row-level import failure that can be reviewed and acknowledged. */
export type MemberImportFailure = {
  lineNumber: number
  message: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  externalId: string | null
}

export type MemberImportClassification = {
  linesProcessed: number
  skipped: ParsedMemberCsvRow[]
  toInsert: ParsedMemberCsvRow[]
  /** Only Bet. current year differs; sheet paid, DB unpaid — auto-applied on import. */
  autoPaidFromSheet: MemberImportConflict[]
  /** Only Bet. current year differs; sheet unpaid, DB paid — warning review queue. */
  paymentWarnings: MemberImportConflict[]
  conflicts: MemberImportConflict[]
  errors: MemberImportFailure[]
}

/** Diff label for the current membership year payment column. */
export const CURRENT_YEAR_PAID_DIFF_LABEL = `Bet. ${CURRENT_PAYMENT_YEAR}`

/** True when the only differing field is current-year paid status. */
export function isCurrentYearPaidOnlyDiff(diffs: string[]): boolean {
  return diffs.length === 1 && diffs[0] === CURRENT_YEAR_PAID_DIFF_LABEL
}

function failureFromCsv(
  csv: ParsedMemberCsvRow,
  message: string,
): MemberImportFailure {
  return {
    lineNumber: csv.lineNumber,
    message,
    firstName: csv.firstName,
    lastName: csv.lastName,
    phone: csv.phone,
    externalId: csv.externalId,
  }
}

function failureFromMessage(
  lineNumber: number,
  message: string,
  preview?: Partial<
    Pick<MemberImportFailure, 'firstName' | 'lastName' | 'phone' | 'externalId'>
  >,
): MemberImportFailure {
  return {
    lineNumber,
    message,
    firstName: preview?.firstName ?? null,
    lastName: preview?.lastName ?? null,
    phone: preview?.phone ?? null,
    externalId: preview?.externalId ?? null,
  }
}

const HEADER_ALIASES: Partial<Record<string, MemberCsvHeader>> = {
  id: 'ID',
  fornavn: 'Fornavn',
  etternavn: 'Etternavn',
  adresse: 'Adresse',
  postnr: 'Postnr',
  poststed: 'Poststed',
  mobil: 'Mobil',
  epost: 'Epost',
  'fødselsår': 'Fødselsår',
  fodselsar: 'Fødselsår',
  type: 'Type',
  innmeldt: 'Innmeldt',
  'bet. 2026': 'Bet. 2026',
  'bet 2026': 'Bet. 2026',
  'bet.2026': 'Bet. 2026',
  'bet. 25 i fjor': 'Bet. 25 i fjor',
  'bet 25 i fjor': 'Bet. 25 i fjor',
  'bet.25 i fjor': 'Bet. 25 i fjor',
}

function normalizeHeader(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function parseBooleanCell(raw: string | undefined): boolean {
  if (raw == null) return false
  const v = raw.trim().toLowerCase()
  if (!v) return false
  if (['nei', 'no', 'n', '0', 'false', 'f'].includes(v)) return false
  if (['ja', 'yes', 'y', '1', 'true', 't', 'x', '✓', '✔'].includes(v)) return true
  // Non-empty unknown values treated as paid (club sheets often use amounts/dates)
  return true
}

function parseBirthYear(raw: string | undefined): number | null {
  if (raw == null || !raw.trim()) return null
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null
  return n
}

/** Accept YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, YYYY */
function parseJoinedAt(raw: string | undefined): string | null {
  if (raw == null || !raw.trim()) return null
  const v = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const dmy = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${month}-${day}`
  }
  if (/^\d{4}$/.test(v)) return `${v}-01-01`
  return null
}

function emptyToNull(s: string): string | null {
  const t = s.trim()
  return t ? t : null
}

function normText(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return semis >= commas ? ';' : ','
}

export function parseMemberCsv(text: string): {
  rows: ParsedMemberCsvRow[]
  errors: MemberImportFailure[]
} {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0)

  if (nonEmpty.length === 0) {
    return {
      rows: [],
      errors: [failureFromMessage(0, 'Filen er tom.')],
    }
  }

  const delimiter = detectDelimiter(nonEmpty[0].line)
  const headerCells = splitCsvLine(nonEmpty[0].line, delimiter).map((c) =>
    normalizeHeader(c),
  )

  const columnIndex = new Map<MemberCsvHeader, number>()
  for (let i = 0; i < headerCells.length; i++) {
    const mapped = HEADER_ALIASES[headerCells[i]]
    if (mapped) columnIndex.set(mapped, i)
  }

  const required: MemberCsvHeader[] = ['Fornavn', 'Etternavn']
  for (const h of required) {
    if (!columnIndex.has(h)) {
      return {
        rows: [],
        errors: [
          failureFromMessage(
            nonEmpty[0].lineNumber,
            `Mangler kolonne: ${h}`,
          ),
        ],
      }
    }
  }

  const rows: ParsedMemberCsvRow[] = []
  const errors: MemberImportFailure[] = []

  for (const { line, lineNumber } of nonEmpty.slice(1)) {
    const cells = splitCsvLine(line, delimiter)
    const get = (h: MemberCsvHeader) => {
      const idx = columnIndex.get(h)
      if (idx == null) return undefined
      return cells[idx]
    }

    const firstName = (get('Fornavn') ?? '').trim()
    const lastName = (get('Etternavn') ?? '').trim()
    if (!firstName && !lastName) continue

    if (!firstName || !lastName) {
      errors.push(
        failureFromMessage(lineNumber, 'Fornavn og etternavn er påkrevd.', {
          firstName: firstName || null,
          lastName: lastName || null,
          externalId: emptyToNull(get('ID') ?? ''),
          phone: null,
        }),
      )
      continue
    }

    const phoneRaw = get('Mobil') ?? ''
    const phone = phoneRaw.trim() ? normalizeMemberPhone(phoneRaw) : null
    if (phoneRaw.trim() && !phone) {
      errors.push(
        failureFromMessage(lineNumber, 'Ugyldig mobilnummer.', {
          firstName,
          lastName,
          externalId: emptyToNull(get('ID') ?? ''),
          phone: phoneRaw.trim(),
        }),
      )
      continue
    }

    const paid2026 = parseBooleanCell(get('Bet. 2026'))
    const paid2025 = parseBooleanCell(get('Bet. 25 i fjor'))

    rows.push({
      lineNumber,
      externalId: emptyToNull(get('ID') ?? ''),
      firstName,
      lastName,
      address: emptyToNull(get('Adresse') ?? ''),
      postalCode: emptyToNull(get('Postnr') ?? ''),
      city: emptyToNull(get('Poststed') ?? ''),
      phone,
      email: emptyToNull(get('Epost') ?? ''),
      birthYear: parseBirthYear(get('Fødselsår')),
      memberType: emptyToNull(get('Type') ?? ''),
      joinedAt: parseJoinedAt(get('Innmeldt')),
      payments: [
        { year: CURRENT_PAYMENT_YEAR, paid: paid2026 },
        { year: PREVIOUS_PAYMENT_YEAR, paid: paid2025 },
      ],
      paid: paid2026,
    })
  }

  return { rows, errors }
}

function paymentMap(payments: MemberPaymentYear[]): Map<number, boolean> {
  const m = new Map<number, boolean>()
  for (const p of payments) m.set(p.year, p.paid)
  return m
}

export type MemberMatchResult =
  | { kind: 'none' }
  | { kind: 'match'; member: ExistingMemberForImport }
  | { kind: 'ambiguous_phone' }

export function findMatchingMember(
  csv: ParsedMemberCsvRow,
  byExternalId: Map<string, ExistingMemberForImport>,
  byPhone: Map<string, ExistingMemberForImport[]>,
): MemberMatchResult {
  // When CSV has an ID, match only by that ID — never fall through to phone
  // (phones are not unique).
  if (csv.externalId) {
    const byId = byExternalId.get(csv.externalId)
    return byId ? { kind: 'match', member: byId } : { kind: 'none' }
  }
  if (csv.phone) {
    const matches = byPhone.get(csv.phone) ?? []
    if (matches.length === 1) return { kind: 'match', member: matches[0] }
    if (matches.length > 1) return { kind: 'ambiguous_phone' }
  }
  return { kind: 'none' }
}

const COMPARE_FIELDS: {
  key: string
  label: string
  csv: (r: ParsedMemberCsvRow) => string
  existing: (m: ExistingMemberForImport) => string
}[] = [
  {
    key: 'external_id',
    label: 'ID',
    csv: (r) => normText(r.externalId),
    existing: (m) => normText(m.external_id),
  },
  {
    key: 'first_name',
    label: 'Fornavn',
    csv: (r) => normText(r.firstName),
    existing: (m) => normText(m.first_name),
  },
  {
    key: 'last_name',
    label: 'Etternavn',
    csv: (r) => normText(r.lastName),
    existing: (m) => normText(m.last_name),
  },
  {
    key: 'address',
    label: 'Adresse',
    csv: (r) => normText(r.address),
    existing: (m) => normText(m.address),
  },
  {
    key: 'postal_code',
    label: 'Postnr',
    csv: (r) => normText(r.postalCode),
    existing: (m) => normText(m.postal_code),
  },
  {
    key: 'city',
    label: 'Poststed',
    csv: (r) => normText(r.city),
    existing: (m) => normText(m.city),
  },
  {
    key: 'phone',
    label: 'Mobil',
    csv: (r) => normText(r.phone),
    existing: (m) => normText(m.phone),
  },
  {
    key: 'email',
    label: 'Epost',
    csv: (r) => normText(r.email),
    existing: (m) => normText(m.email),
  },
  {
    key: 'birth_year',
    label: 'Fødselsår',
    csv: (r) => (r.birthYear == null ? '' : String(r.birthYear)),
    existing: (m) => (m.birth_year == null ? '' : String(m.birth_year)),
  },
  {
    key: 'member_type',
    label: 'Type',
    csv: (r) => normText(r.memberType),
    existing: (m) => normText(m.member_type),
  },
  {
    key: 'joined_at',
    label: 'Innmeldt',
    csv: (r) => normText(r.joinedAt),
    existing: (m) => normText(m.joined_at),
  },
]

export function differingFields(
  existing: ExistingMemberForImport,
  csv: ParsedMemberCsvRow,
): string[] {
  const diffs: string[] = []
  for (const f of COMPARE_FIELDS) {
    if (f.csv(csv) !== f.existing(existing)) diffs.push(f.label)
  }

  const existingPay = paymentMap(existing.payments)
  for (const p of csv.payments) {
    const existingVal = existingPay.get(p.year)
    // Missing year in DB treated as unpaid (false) for comparison
    if ((existingVal ?? false) !== p.paid) {
      diffs.push(
        p.year === CURRENT_PAYMENT_YEAR
          ? CURRENT_YEAR_PAID_DIFF_LABEL
          : `Bet. ${p.year}`,
      )
    }
  }

  return diffs
}

export function classifyMemberImport(
  csvRows: ParsedMemberCsvRow[],
  existingMembers: ExistingMemberForImport[],
  parseErrors: MemberImportFailure[] = [],
): MemberImportClassification {
  const byExternalId = new Map<string, ExistingMemberForImport>()
  const byPhone = new Map<string, ExistingMemberForImport[]>()
  for (const m of existingMembers) {
    if (m.external_id) byExternalId.set(m.external_id, m)
    if (m.phone) {
      const list = byPhone.get(m.phone) ?? []
      list.push(m)
      byPhone.set(m.phone, list)
    }
  }

  const skipped: ParsedMemberCsvRow[] = []
  const toInsert: ParsedMemberCsvRow[] = []
  const autoPaidFromSheet: MemberImportConflict[] = []
  const paymentWarnings: MemberImportConflict[] = []
  const conflicts: MemberImportConflict[] = []
  const errors = [...parseErrors]
  /** External IDs already used by an earlier CSV row in this import. */
  const claimedExternalIds = new Set<string>()

  for (const csv of csvRows) {
    if (!csv.phone && !csv.externalId) {
      errors.push(
        failureFromCsv(csv, 'Mangler mobil og ID — kan ikke importere.'),
      )
      continue
    }

    if (csv.externalId && claimedExternalIds.has(csv.externalId)) {
      errors.push(
        failureFromCsv(csv, `Duplikat ID i filen: ${csv.externalId}`),
      )
      continue
    }

    const matchResult = findMatchingMember(csv, byExternalId, byPhone)
    if (csv.externalId) claimedExternalIds.add(csv.externalId)

    if (matchResult.kind === 'ambiguous_phone') {
      errors.push(
        failureFromCsv(
          csv,
          `Flere medlemmer har mobil ${csv.phone} — mangler ID.`,
        ),
      )
      continue
    }

    if (matchResult.kind === 'none') {
      // New members may omit phone when they have an external ID.
      toInsert.push(csv)
      continue
    }

    const match = matchResult.member
    const diffs = differingFields(match, csv)
    if (diffs.length === 0) {
      skipped.push(csv)
    } else if (isCurrentYearPaidOnlyDiff(diffs)) {
      const conflict: MemberImportConflict = {
        existing: match,
        csv,
        differingFields: diffs,
      }
      const dbCurrentPaid =
        paymentMap(match.payments).get(CURRENT_PAYMENT_YEAR) ?? false
      if (csv.paid && !dbCurrentPaid) {
        autoPaidFromSheet.push(conflict)
      } else if (!csv.paid && dbCurrentPaid) {
        paymentWarnings.push(conflict)
      } else {
        // Defensive: paid flags aligned but payment year row differed — treat as conflict.
        conflicts.push(conflict)
      }
    } else {
      conflicts.push({ existing: match, csv, differingFields: diffs })
    }
  }

  return {
    linesProcessed: csvRows.length,
    skipped,
    toInsert,
    autoPaidFromSheet,
    paymentWarnings,
    conflicts,
    errors,
  }
}

export function displayValue(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value)
}

export type ConflictFieldRow = {
  label: string
  existing: string
  csv: string
  differs: boolean
}

function existingDisplayForKey(
  key: string,
  m: ExistingMemberForImport,
): string {
  switch (key) {
    case 'external_id':
      return displayValue(m.external_id)
    case 'first_name':
      return m.first_name
    case 'last_name':
      return m.last_name
    case 'address':
      return displayValue(m.address)
    case 'postal_code':
      return displayValue(m.postal_code)
    case 'city':
      return displayValue(m.city)
    case 'phone':
      return displayValue(m.phone)
    case 'email':
      return displayValue(m.email)
    case 'birth_year':
      return displayValue(m.birth_year)
    case 'member_type':
      return displayValue(m.member_type)
    case 'joined_at':
      return displayValue(m.joined_at)
    default:
      return '—'
  }
}

function csvDisplayForKey(key: string, r: ParsedMemberCsvRow): string {
  switch (key) {
    case 'external_id':
      return displayValue(r.externalId)
    case 'first_name':
      return r.firstName
    case 'last_name':
      return r.lastName
    case 'address':
      return displayValue(r.address)
    case 'postal_code':
      return displayValue(r.postalCode)
    case 'city':
      return displayValue(r.city)
    case 'phone':
      return displayValue(r.phone)
    case 'email':
      return displayValue(r.email)
    case 'birth_year':
      return displayValue(r.birthYear)
    case 'member_type':
      return displayValue(r.memberType)
    case 'joined_at':
      return displayValue(r.joinedAt)
    default:
      return '—'
  }
}

export function buildConflictFieldRows(
  conflict: MemberImportConflict,
): ConflictFieldRow[] {
  const { existing, csv } = conflict
  const rows: ConflictFieldRow[] = COMPARE_FIELDS.map((f) => ({
    label: f.label,
    existing: existingDisplayForKey(f.key, existing),
    csv: csvDisplayForKey(f.key, csv),
    differs: f.csv(csv) !== f.existing(existing),
  }))

  const existingPay = paymentMap(existing.payments)
  for (const p of csv.payments) {
    const ePaid = existingPay.get(p.year) ?? false
    const label =
      p.year === CURRENT_PAYMENT_YEAR
        ? CURRENT_YEAR_PAID_DIFF_LABEL
        : p.year === PREVIOUS_PAYMENT_YEAR
          ? 'Bet. 25 i fjor'
          : `Bet. ${p.year}`
    rows.push({
      label,
      existing: ePaid ? 'Ja' : 'Nei',
      csv: p.paid ? 'Ja' : 'Nei',
      differs: ePaid !== p.paid,
    })
  }

  return rows
}
