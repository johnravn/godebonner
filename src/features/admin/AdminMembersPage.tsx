import { Button, Checkbox, Fieldset, Frame, Input, Tab, Tabs } from '@react95/core'
import { Delete, FilePen } from '@react95/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState } from 'react'
import {
  buildConflictFieldRows,
  classifyMemberImport,
  findMatchingMember,
  parseMemberCsv,
} from '#/features/admin/member-csv-import'
import type {
  ExistingMemberForImport,
  MemberImportConflict,
  MemberImportClassification,
  MemberImportFailure,
  ParsedMemberCsvRow,
} from '#/features/admin/member-csv-import'
import { MemberImportLogPanel } from '#/features/admin/MemberImportLogPanel'
import {
  createImportCompletedLogEntry,
  createReviewClearedLogEntry,
  loadMemberImportLog,
  persistMemberImportLog,
  type MemberImportLogEntry,
} from '#/features/admin/member-import-log'
import { PaymentChangeLogPanel } from '#/features/admin/PaymentChangeLogPanel'
import {
  PENDING_PAYMENT_VERIFICATION_QUERY_KEY,
  PendingPaymentVerificationPanel,
} from '#/features/admin/PendingPaymentVerificationPanel'
import {
  collectCsvConfirmedPaidMemberIds,
  planPaymentVerificationSync,
} from '#/features/admin/payment-verification'
import { getSupabase } from '#/shared/api/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '#/shared/types/database.types'
import { Win95CopyProgressDialog } from '#/shared/ui/Win95CopyProgressDialog'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { Win95IconButton } from '#/shared/ui/Win95IconButton'
import {
  Table,
  TableBody,
  TableDataCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '#/shared/ui/Win95Table'

type MemberRow = Tables<'members'>

type MemberSortKey =
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'paid'
  | 'coupons_remaining'
  | 'member_type'

type SortDir = 'asc' | 'desc'

type ImportReviewItem =
  | { kind: 'conflict'; conflict: MemberImportConflict }
  | { kind: 'payment_warning'; conflict: MemberImportConflict }
  | { kind: 'failure'; failure: MemberImportFailure }

function buildImportReviewQueue(
  conflicts: MemberImportConflict[],
  paymentWarnings: MemberImportConflict[],
  failures: MemberImportFailure[],
): ImportReviewItem[] {
  return [
    ...paymentWarnings.map((conflict) => ({
      kind: 'payment_warning' as const,
      conflict,
    })),
    ...conflicts.map((conflict) => ({ kind: 'conflict' as const, conflict })),
    ...failures.map((failure) => ({ kind: 'failure' as const, failure })),
  ]
}

async function clearPendingVerification(memberId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('member_payment_pending_verification')
    .delete()
    .eq('member_id', memberId)
  if (error) throw new Error(error.message)
}

async function syncPaymentVerificationsAfterImport(
  confirmedPaidMemberIds: ReadonlySet<string>,
): Promise<void> {
  const { data: pending, error } = await getSupabase()
    .from('member_payment_pending_verification')
    .select('member_id, imports_without_verification')
  if (error) throw new Error(error.message)

  const plan = planPaymentVerificationSync(
    (pending ?? []).map((p) => p.member_id),
    confirmedPaidMemberIds,
  )

  if (plan.toVerify.length > 0) {
    const { error: delError } = await getSupabase()
      .from('member_payment_pending_verification')
      .delete()
      .in('member_id', plan.toVerify)
    if (delError) throw new Error(delError.message)
  }

  const now = new Date().toISOString()
  for (const id of plan.toBump) {
    const row = pending?.find((p) => p.member_id === id)
    if (!row) continue
    const { error: upError } = await getSupabase()
      .from('member_payment_pending_verification')
      .update({
        imports_without_verification: row.imports_without_verification + 1,
        last_import_missed_at: now,
      })
      .eq('member_id', id)
    if (upError) throw new Error(upError.message)
  }
}

function buildCsvConfirmedPaidMemberIds(
  classified: MemberImportClassification,
  existing: ExistingMemberForImport[],
): Set<string> {
  const byExternalId = new Map<string, ExistingMemberForImport>()
  const byPhone = new Map<string, ExistingMemberForImport[]>()
  for (const m of existing) {
    if (m.external_id) byExternalId.set(m.external_id, m)
    if (m.phone) {
      const list = byPhone.get(m.phone) ?? []
      list.push(m)
      byPhone.set(m.phone, list)
    }
  }

  const matched: Array<{ memberId: string; csv: ParsedMemberCsvRow }> = []

  for (const csv of classified.skipped) {
    const match = findMatchingMember(csv, byExternalId, byPhone)
    if (match.kind === 'match') {
      matched.push({ memberId: match.member.id, csv })
    }
  }
  for (const c of classified.autoPaidFromSheet) {
    matched.push({ memberId: c.existing.id, csv: c.csv })
  }
  for (const c of classified.conflicts) {
    matched.push({ memberId: c.existing.id, csv: c.csv })
  }
  for (const c of classified.paymentWarnings) {
    matched.push({ memberId: c.existing.id, csv: c.csv })
  }

  return collectCsvConfirmedPaidMemberIds(matched)
}

type MembersToolbarAction =
  | 'update'
  | 'import'
  | 'conflicts'
  | 'refresh'
  | 'create'
  | 'deleteAll'

const TOOLBAR_HELP: Record<
  MembersToolbarAction,
  { title: string; body: string }
> = {
  update: {
    title: 'Oppdater',
    body: 'Henter medlemslisten på nytt fra databasen. Bruk hvis noe er endret i et annet vindu.',
  },
  import: {
    title: 'Importer medlemmer',
    body: 'Importerer medlemmer fra CSV. Konflikter og feilede rader løses her under «Løs konflikter».',
  },
  conflicts: {
    title: 'Løs konflikter',
    body: 'Går gjennom CSV-konflikter og feilede importerader. Konflikter kan beholdes/overskrives; feil merkes som forstått.',
  },
  refresh: {
    title: 'Oppfrisk årskuponger',
    body: 'Gir alle medlemmer som har betalt i år nye ubrukte kuponger iht. Organisasjon. Gamle ubrukte erstattes; brukte kuponger beholdes i historikken.',
  },
  create: {
    title: 'Legg til medlem',
    body: 'Åpner skjema for å opprette et nytt medlem manuelt. Mobil er valgfritt, men anbefales for kupongoppslag i kassa.',
  },
  deleteAll: {
    title: 'Slett alle medlemmer',
    body: 'Sletter hele medlemslisten, kuponger og betalingsdata permanent. Kun for utvikling eller før en full re-import.',
  },
}

type RefreshResponse = {
  status?: string
  updated_count?: number
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  city: '',
  birthYear: '' as number | string,
  memberType: '',
  joinedAt: '',
  paid: false,
}

const MEMBER_SELECT =
  'id, external_id, first_name, last_name, phone, email, address, postal_code, city, birth_year, member_type, joined_at, paid, coupons_remaining, last_allocation_at, created_at'

/** Matches `.r95-table__cell` row height for virtualization. */
const MEMBER_ROW_HEIGHT = 52
const MEMBER_COL_COUNT = 8

async function upsertMemberPayments(
  memberId: string,
  payments: ParsedMemberCsvRow['payments'],
) {
  if (payments.length === 0) return
  const rows = payments.map((p) => ({
    member_id: memberId,
    year: p.year,
    paid: p.paid,
    recorded_at: new Date().toISOString(),
  }))
  const { error } = await getSupabase()
    .from('member_payments')
    .upsert(rows, { onConflict: 'member_id,year' })
  if (error) throw new Error(error.message)
}

function csvToMemberPatch(csv: ParsedMemberCsvRow): TablesUpdate<'members'> {
  return {
    external_id: csv.externalId,
    first_name: csv.firstName,
    last_name: csv.lastName,
    phone: csv.phone,
    email: csv.email,
    address: csv.address,
    postal_code: csv.postalCode,
    city: csv.city,
    birth_year: csv.birthYear,
    member_type: csv.memberType,
    joined_at: csv.joinedAt,
    paid: csv.paid,
  }
}

async function insertMemberFromCsv(csv: ParsedMemberCsvRow): Promise<void> {
  if (!csv.phone && !csv.externalId) {
    throw new Error(`Linje ${csv.lineNumber}: mangler mobil og ID.`)
  }
  const insert: TablesInsert<'members'> = {
    external_id: csv.externalId,
    first_name: csv.firstName,
    last_name: csv.lastName,
    phone: csv.phone,
    email: csv.email,
    address: csv.address,
    postal_code: csv.postalCode,
    city: csv.city,
    birth_year: csv.birthYear,
    member_type: csv.memberType,
    joined_at: csv.joinedAt,
    paid: csv.paid,
  }
  const { data, error } = await getSupabase()
    .from('members')
    .insert(insert)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await upsertMemberPayments(data.id, csv.payments)
}

async function updateMemberFromCsv(
  memberId: string,
  csv: ParsedMemberCsvRow,
): Promise<void> {
  const patch = csvToMemberPatch(csv)
  const { error } = await getSupabase()
    .from('members')
    .update(patch)
    .eq('id', memberId)
  if (error) throw new Error(error.message)
  await upsertMemberPayments(memberId, csv.payments)
}

/** Keep DB row; optionally attach missing external_id from CSV. */
async function keepExistingOnConflict(
  conflict: MemberImportConflict,
): Promise<void> {
  if (!conflict.existing.external_id && conflict.csv.externalId) {
    const { error } = await getSupabase()
      .from('members')
      .update({ external_id: conflict.csv.externalId })
      .eq('id', conflict.existing.id)
    if (error) throw new Error(error.message)
  }
}

export function AdminMembersPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [memberToDelete, setMemberToDelete] = useState<MemberRow | null>(null)
  const [refreshOpen, setRefreshOpen] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [membersTab, setMembersTab] = useState('Oversikt')
  const [importBusy, setImportBusy] = useState(false)
  const [importProgress, setImportProgress] = useState<{
    fromLabel: string
    statusText: string
    percent: number
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<{
    linesProcessed: number
    alreadyInSystem: number
    newlyAdded: number
    membershipPaidFromSheet: number
    conflictsFound: number
    errorCount: number
  } | null>(null)
  const [conflictQueue, setConflictQueue] = useState<ImportReviewItem[]>([])
  const [conflictIndex, setConflictIndex] = useState(0)
  const [conflictBusy, setConflictBusy] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [conflictResolverOpen, setConflictResolverOpen] = useState(false)
  const [importLog, setImportLog] = useState<MemberImportLogEntry[]>(() =>
    loadMemberImportLog(),
  )
  const lastImportFileRef = useRef<string | null>(null)
  const [hoveredAction, setHoveredAction] =
    useState<MembersToolbarAction | null>(null)
  const [sortKey, setSortKey] = useState<MemberSortKey>('last_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const actionHelp = hoveredAction ? TOOLBAR_HELP[hoveredAction] : null
  const pendingConflictCount = conflictQueue.length
  const pendingConflicts = conflictQueue.filter(
    (i) => i.kind === 'conflict' || i.kind === 'payment_warning',
  ).length
  const pendingPaymentWarnings = conflictQueue.filter(
    (i) => i.kind === 'payment_warning',
  ).length
  const pendingFailures = conflictQueue.filter((i) => i.kind === 'failure').length

  function appendImportLog(entry: MemberImportLogEntry) {
    setImportLog((prev) => {
      const next = [entry, ...prev].slice(0, 80)
      persistMemberImportLog(next)
      return next
    })
  }

  function clearImportLog() {
    setImportLog([])
    persistMemberImportLog([])
  }

  const isEdit = editingId !== null

  const { data: members, isPending, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await getSupabase()
        .from('members')
        .select(MEMBER_SELECT)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })

      if (error) throw error
      return data
    },
  })

  const rows = useMemo(() => {
    const list = [...(members ?? [])]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        return (Number(av) - Number(bv)) * dir
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir
      }
      const as = (av ?? '').toString().toLocaleLowerCase('nb')
      const bs = (bv ?? '').toString().toLocaleLowerCase('nb')
      return as.localeCompare(bs, 'nb', { sensitivity: 'base' }) * dir
    })
    return list
  }, [members, sortKey, sortDir])
  const memberCount = rows.length

  function toggleSort(key: MemberSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  function sortProp(key: MemberSortKey): SortDir | false {
    return sortKey === key ? sortDir : false
  }

  const tableScrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => MEMBER_ROW_HEIGHT,
    overscan: 16,
    getItemKey: (index) => rows[index]?.id ?? index,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0

  function openCreate() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      joinedAt: new Date().toISOString().slice(0, 10),
    })
    setEditOpen(true)
  }

  function openEdit(member: MemberRow) {
    setEditingId(member.id)
    setForm({
      firstName: member.first_name,
      lastName: member.last_name,
      phone: member.phone ?? '',
      email: member.email ?? '',
      address: member.address ?? '',
      postalCode: member.postal_code ?? '',
      city: member.city ?? '',
      birthYear: member.birth_year ?? '',
      memberType: member.member_type ?? '',
      joinedAt: member.joined_at ?? '',
      paid: member.paid,
    })
    setEditOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fn = form.firstName.trim()
      const ln = form.lastName.trim()
      if (!fn || !ln) {
        throw new Error('Fyll inn fornavn og etternavn.')
      }

      const phoneTrimmed = form.phone.trim()
      const phone = phoneTrimmed || null

      const birthYearRaw =
        typeof form.birthYear === 'string'
          ? form.birthYear.trim()
          : String(form.birthYear)
      let birthYear: number | null = null
      if (birthYearRaw) {
        const parsed = Number.parseInt(birthYearRaw, 10)
        if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100) {
          throw new Error('Ugyldig fødselsår.')
        }
        birthYear = parsed
      }

      const patch: TablesUpdate<'members'> = {
        first_name: fn,
        last_name: ln,
        phone,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        postal_code: form.postalCode.trim() || null,
        city: form.city.trim() || null,
        birth_year: birthYear,
        member_type: form.memberType.trim() || null,
        joined_at: form.joinedAt.trim() || null,
        paid: form.paid,
      }

      if (isEdit) {
        const { error } = await getSupabase()
          .from('members')
          .update(patch)
          .eq('id', editingId)
        if (error) throw new Error(error.message)
        return
      }

      const insert: TablesInsert<'members'> = {
        first_name: fn,
        last_name: ln,
        phone,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        postal_code: form.postalCode.trim() || null,
        city: form.city.trim() || null,
        birth_year: birthYear,
        member_type: form.memberType.trim() || null,
        joined_at: form.joinedAt.trim() || null,
        paid: form.paid,
      }
      const { error } = await getSupabase().from('members').insert(insert)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] })
      setEditOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('members').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] })
      setMemberToDelete(null)
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      // PostgREST requires a filter; match every row.
      const { error } = await getSupabase()
        .from('members')
        .delete()
        .gte('created_at', '1970-01-01')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] })
      setDeleteAllOpen(false)
    },
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc('admin_refresh_yearly_coupons')
      if (error) throw new Error(error.message)
      const parsed = (data ?? {}) as RefreshResponse
      if (parsed.status === 'forbidden') {
        throw new Error('Du har ikke tilgang til å oppfriske kuponger.')
      }
      if (parsed.status === 'not_authenticated') {
        throw new Error('Du må være innlogget.')
      }
      if (parsed.status !== 'ok') {
        throw new Error('Kunne ikke oppfriske kuponger.')
      }
      return parsed
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] })
      setRefreshOpen(false)
    },
  })

  function setField<TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function loadExistingForImport(): Promise<ExistingMemberForImport[]> {
    const { data: memberRows, error: membersError } = await getSupabase()
      .from('members')
      .select(
        'id, external_id, first_name, last_name, address, postal_code, city, phone, email, birth_year, member_type, joined_at, paid',
      )
    if (membersError) throw new Error(membersError.message)

    const { data: paymentRows, error: paymentsError } = await getSupabase()
      .from('member_payments')
      .select('member_id, year, paid')
    if (paymentsError) throw new Error(paymentsError.message)

    const paymentsByMember = new Map<
      string,
      { year: number; paid: boolean }[]
    >()
    for (const p of paymentRows) {
      const list = paymentsByMember.get(p.member_id) ?? []
      list.push({ year: p.year, paid: p.paid })
      paymentsByMember.set(p.member_id, list)
    }

    return memberRows.map((m) => ({
      ...m,
      payments: paymentsByMember.get(m.id) ?? [],
    }))
  }

  async function runImport(file: File) {
    const startedAt = Date.now()
    lastImportFileRef.current = file.name
    setImportBusy(true)
    setImportError(null)
    setImportSummary(null)
    setImportProgress({
      fromLabel: file.name,
      statusText: 'Leser CSV-fil…',
      percent: 2,
    })
    try {
      const text = await file.text()
      setImportProgress({
        fromLabel: file.name,
        statusText: 'Analyserer medlemsdata…',
        percent: 8,
      })
      const { rows: csvRows, errors: parseErrors } = parseMemberCsv(text)
      const structuralError = parseErrors.find(
        (e) =>
          e.message === 'Filen er tom.' ||
          e.message.startsWith('Mangler kolonne:'),
      )
      if (structuralError) {
        throw new Error(structuralError.message)
      }

      setImportProgress({
        fromLabel: file.name,
        statusText: 'Henter eksisterende medlemmer…',
        percent: 14,
      })
      const existing = await loadExistingForImport()
      const classified: MemberImportClassification = classifyMemberImport(
        csvRows,
        existing,
        parseErrors,
      )

      const insertTotal = classified.toInsert.length
      const autoPaidTotal = classified.autoPaidFromSheet.length
      const writeTotal = insertTotal + autoPaidTotal
      let newlyAdded = 0
      let membershipPaidFromSheet = 0

      for (const row of classified.toInsert) {
        await insertMemberFromCsv(row)
        newlyAdded++
        const writeShare = writeTotal === 0 ? 1 : (newlyAdded + membershipPaidFromSheet) / writeTotal
        setImportProgress({
          fromLabel: file.name,
          statusText:
            writeTotal === 0
              ? 'Fullfører import…'
              : `Kopierer medlem ${newlyAdded + membershipPaidFromSheet} av ${writeTotal}…`,
          percent: Math.round(18 + writeShare * 70),
        })
      }

      for (const conflict of classified.autoPaidFromSheet) {
        await updateMemberFromCsv(conflict.existing.id, conflict.csv)
        membershipPaidFromSheet++
        const writeShare =
          writeTotal === 0
            ? 1
            : (newlyAdded + membershipPaidFromSheet) / writeTotal
        setImportProgress({
          fromLabel: file.name,
          statusText: `Registrerer betalt medlemskap ${membershipPaidFromSheet} av ${autoPaidTotal}…`,
          percent: Math.round(18 + writeShare * 70),
        })
      }

      setImportProgress({
        fromLabel: file.name,
        statusText: 'Synkroniserer betalingsverifisering…',
        percent: 92,
      })
      const confirmedPaid = buildCsvConfirmedPaidMemberIds(classified, existing)
      await syncPaymentVerificationsAfterImport(confirmedPaid)

      setImportProgress({
        fromLabel: file.name,
        statusText: 'Fullfører import…',
        percent: 100,
      })

      const reviewConflicts =
        classified.conflicts.length + classified.paymentWarnings.length
      setConflictQueue(
        buildImportReviewQueue(
          classified.conflicts,
          classified.paymentWarnings,
          classified.errors,
        ),
      )
      setConflictIndex(0)
      setConflictError(null)
      setConflictResolverOpen(false)

      const elapsed = Date.now() - startedAt
      if (elapsed < 900) {
        await new Promise((resolve) => setTimeout(resolve, 900 - elapsed))
      }

      setImportSummary({
        linesProcessed: classified.linesProcessed + parseErrors.length,
        alreadyInSystem: classified.skipped.length,
        newlyAdded,
        membershipPaidFromSheet,
        conflictsFound: reviewConflicts,
        errorCount: classified.errors.length,
      })

      appendImportLog(
        createImportCompletedLogEntry({
          fileName: file.name,
          linesProcessed: classified.linesProcessed + parseErrors.length,
          newlyAdded,
          alreadyInSystem: classified.skipped.length,
          membershipPaidFromSheet,
          conflictsFound: reviewConflicts,
          errorCount: classified.errors.length,
        }),
      )

      if (reviewConflicts === 0 && classified.errors.length === 0) {
        appendImportLog(
          createReviewClearedLogEntry({ fileName: file.name }),
        )
      }

      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] })
      void queryClient.invalidateQueries({
        queryKey: PENDING_PAYMENT_VERIFICATION_QUERY_KEY,
      })
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payment-change-log'],
      })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import feilet.')
    } finally {
      setImportBusy(false)
      setImportProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function toolbarHelpProps(action: MembersToolbarAction) {
    return {
      onMouseEnter: () => setHoveredAction(action),
      onFocus: () => setHoveredAction(action),
    }
  }

  function advanceReviewItem() {
    setConflictError(null)
    setConflictQueue((queue) => {
      const next = queue.filter((_, i) => i !== conflictIndex)
      if (next.length === 0) {
        setConflictResolverOpen(false)
        setConflictIndex(0)
        appendImportLog(
          createReviewClearedLogEntry({
            fileName: lastImportFileRef.current ?? undefined,
          }),
        )
        return []
      }
      setConflictIndex((i) => Math.min(i, next.length - 1))
      return next
    })
  }

  async function resolveConflict(action: 'keep' | 'use_csv' | 'skip') {
    const item = conflictQueue[conflictIndex]
    if (
      !item ||
      (item.kind !== 'conflict' && item.kind !== 'payment_warning')
    ) {
      return
    }
    setConflictBusy(true)
    setConflictError(null)
    try {
      if (action === 'keep') {
        await keepExistingOnConflict(item.conflict)
      } else if (action === 'use_csv') {
        await updateMemberFromCsv(item.conflict.existing.id, item.conflict.csv)
        // Sheet is now source of truth — leave the pending-verification list.
        await clearPendingVerification(item.conflict.existing.id)
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] })
      void queryClient.invalidateQueries({
        queryKey: PENDING_PAYMENT_VERIFICATION_QUERY_KEY,
      })
      advanceReviewItem()
    } catch (err) {
      setConflictError(err instanceof Error ? err.message : 'Kunne ikke lagre.')
    } finally {
      setConflictBusy(false)
    }
  }

  function acknowledgeFailure() {
    const item = conflictQueue[conflictIndex]
    if (!item || item.kind !== 'failure') return
    advanceReviewItem()
  }

  const activeReviewItem =
    conflictQueue.length > 0 ? conflictQueue[conflictIndex] : null
  const activeConflict =
    activeReviewItem?.kind === 'conflict' ||
    activeReviewItem?.kind === 'payment_warning'
      ? activeReviewItem.conflict
      : null
  const activePaymentWarning = activeReviewItem?.kind === 'payment_warning'
  const activeFailure =
    activeReviewItem?.kind === 'failure' ? activeReviewItem.failure : null
  const conflictFields = activeConflict
    ? buildConflictFieldRows(activeConflict)
    : []

  return (
    <Frame
      display="flex"
      flexDirection="column"
      gap="$3"
      height="100%"
      style={{ minHeight: 0 }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          if (file) void runImport(file)
        }}
      />

      <Frame
        className="admin-members-tabs"
        display="flex"
        flexDirection="column"
        height="100%"
        style={{ minHeight: 0, flex: 1 }}
      >
        <Tabs
          className="win95-menu-tabs"
          defaultActiveTab={membersTab}
          onChange={(title) => {
            setMembersTab(title)
            setHoveredAction(null)
          }}
        >
        <Tab title="Oversikt">
          <Frame
            className="win95-admin-tab-body admin-members-tab"
            display="flex"
            flexDirection="column"
            gap="$3"
            height="100%"
            style={{ minHeight: 0 }}
          >
            <Frame
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
              gap="$3"
              style={{ flexShrink: 0 }}
            >
              <Frame display="flex" flexDirection="column" gap="$1" maxWidth="420px">
                <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
                  Administrer medlemsdata. Bruk «Registrer kupong» for å trekke
                  kuponger i kassa. Import og logg finner du i fanene ved siden av.
                </p>
              </Frame>
              <Frame
                display="flex"
                gap="$2"
                alignItems="stretch"
                style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}
              >
                <Fieldset
                  legend={actionHelp?.title ?? 'Informasjon'}
                  className="admin-members-help"
                  style={{
                    flex: '1 1 240px',
                    maxWidth: 420,
                    minWidth: 180,
                    padding: '8px 12px',
                  }}
                >
                  {actionHelp ? (
                    <p className="admin-members-help__body">{actionHelp.body}</p>
                  ) : (
                    <p className="admin-members-help__body win95-muted">
                      Hold musepekeren over en knapp for mer informasjon.
                    </p>
                  )}
                </Fieldset>
                <Fieldset
                  legend="Medlemmer"
                  style={{ minWidth: 120, padding: '8px 12px', flexShrink: 0 }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      display: 'block',
                      textAlign: 'center',
                    }}
                  >
                    {isPending ? '…' : memberCount}
                  </span>
                </Fieldset>
              </Frame>
            </Frame>

            <Frame display="flex" gap="$2" flexWrap="wrap" style={{ flexShrink: 0 }}>
              <Button
                disabled={isFetching}
                onClick={() => void refetch()}
                {...toolbarHelpProps('update')}
              >
                {isFetching && !isPending ? 'Oppdaterer…' : 'Oppdater'}
              </Button>
              <Button
                onClick={() => setRefreshOpen(true)}
                {...toolbarHelpProps('refresh')}
              >
                Oppfrisk årskuponger
              </Button>
              <Button onClick={openCreate} {...toolbarHelpProps('create')}>
                Legg til medlem
              </Button>
              <Button
                disabled={memberCount === 0 || deleteAllMutation.isPending}
                onClick={() => setDeleteAllOpen(true)}
                {...toolbarHelpProps('deleteAll')}
              >
                Slett alle medlemmer
              </Button>
            </Frame>

      <Table
        ref={tableScrollRef}
        minWidth={900}
        className="admin-members-table"
      >
        <TableHead>
          <TableRow>
            <TableHeadCell
              sort={sortProp('first_name')}
              onClick={() => toggleSort('first_name')}
            >
              Fornavn
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('last_name')}
              onClick={() => toggleSort('last_name')}
            >
              Etternavn
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('phone')}
              onClick={() => toggleSort('phone')}
            >
              Telefon
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('email')}
              onClick={() => toggleSort('email')}
            >
              E-post
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('paid')}
              onClick={() => toggleSort('paid')}
            >
              Betalt i år
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('coupons_remaining')}
              onClick={() => toggleSort('coupons_remaining')}
            >
              Kuponger
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('member_type')}
              onClick={() => toggleSort('member_type')}
            >
              Type
            </TableHeadCell>
            <TableHeadCell style={{ width: 120 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableDataCell colSpan={MEMBER_COL_COUNT}>Laster…</TableDataCell>
            </TableRow>
          ) : null}
          {!isPending && rows.length === 0 ? (
            <TableRow>
              <TableDataCell colSpan={MEMBER_COL_COUNT} className="win95-muted">
                Ingen medlemmer ennå. Legg til et medlem for å komme i gang.
              </TableDataCell>
            </TableRow>
          ) : null}
          {!isPending && rows.length > 0 ? (
            <>
              {paddingTop > 0 ? (
                <tr aria-hidden>
                  <td
                    colSpan={MEMBER_COL_COUNT}
                    style={{
                      height: paddingTop,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
              ) : null}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null
                return (
                  <TableRow
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                  >
                    <TableDataCell>{row.first_name}</TableDataCell>
                    <TableDataCell>{row.last_name}</TableDataCell>
                    <TableDataCell
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    >
                      {row.phone ?? '—'}
                    </TableDataCell>
                    <TableDataCell style={{ fontSize: 12 }}>
                      {row.email ?? '—'}
                    </TableDataCell>
                    <TableDataCell>{row.paid ? 'Ja' : 'Nei'}</TableDataCell>
                    <TableDataCell>{row.coupons_remaining}</TableDataCell>
                    <TableDataCell>{row.member_type ?? '—'}</TableDataCell>
                    <TableDataCell>
                      <Frame display="flex" gap="$4" justifyContent="flex-end">
                        <Win95IconButton
                          label="Rediger"
                          onClick={() => openEdit(row)}
                        >
                          <FilePen variant="32x32_4" width={32} height={32} />
                        </Win95IconButton>
                        <Win95IconButton
                          label="Slett"
                          onClick={() => setMemberToDelete(row)}
                        >
                          <Delete variant="16x16_4" width={32} height={32} />
                        </Win95IconButton>
                      </Frame>
                    </TableDataCell>
                  </TableRow>
                )
              })}
              {paddingBottom > 0 ? (
                <tr aria-hidden>
                  <td
                    colSpan={MEMBER_COL_COUNT}
                    style={{
                      height: paddingBottom,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
              ) : null}
            </>
          ) : null}
        </TableBody>
      </Table>


            {saveMutation.isError && saveMutation.error instanceof Error ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
                {saveMutation.error.message}
              </p>
            ) : null}
            {deleteMutation.isError && deleteMutation.error instanceof Error ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
                {deleteMutation.error.message}
              </p>
            ) : null}
            {deleteAllMutation.isError && deleteAllMutation.error instanceof Error ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
                {deleteAllMutation.error.message}
              </p>
            ) : null}
            {refreshMutation.isError && refreshMutation.error instanceof Error ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
                {refreshMutation.error.message}
              </p>
            ) : null}
          </Frame>
        </Tab>

        <Tab title="Import og konflikter">
          <Frame
            className="win95-admin-tab-body admin-members-tab"
            display="flex"
            flexDirection="row"
            gap="$3"
            height="100%"
            style={{ minHeight: 0 }}
          >
            <Frame
              display="flex"
              flexDirection="column"
              gap="$3"
              style={{ flex: '1 1 55%', minWidth: 0, minHeight: 0 }}
            >
            <p className="win95-muted" style={{ margin: 0, fontSize: 13, flexShrink: 0 }}>
              Importer medlemslister fra CSV, og gå gjennom konflikter og
              feilede rader. Fullførte importer logges under Logg.
            </p>
            <Frame
              display="flex"
              gap="$2"
              alignItems="stretch"
              style={{ flexShrink: 0, minWidth: 0 }}
            >
              <Fieldset
                legend={
                  hoveredAction === 'import' || hoveredAction === 'conflicts'
                    ? (actionHelp?.title ?? 'Informasjon')
                    : 'Informasjon'
                }
                className="admin-members-help"
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  padding: '8px 12px',
                }}
              >
                {hoveredAction === 'import' || hoveredAction === 'conflicts' ? (
                  <p className="admin-members-help__body">{actionHelp?.body}</p>
                ) : (
                  <p className="admin-members-help__body win95-muted">
                    Hold musepekeren over en knapp for mer informasjon.
                  </p>
                )}
              </Fieldset>
              <Fieldset
                legend="Medlemmer"
                style={{ minWidth: 120, padding: '8px 12px', flexShrink: 0 }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    display: 'block',
                    textAlign: 'center',
                  }}
                >
                  {isPending ? '…' : memberCount}
                </span>
              </Fieldset>
            </Frame>

            <Frame display="flex" gap="$2" flexWrap="wrap" style={{ flexShrink: 0 }}>
              <Button
                disabled={importBusy}
                onClick={() => fileInputRef.current?.click()}
                {...toolbarHelpProps('import')}
              >
                {importBusy ? 'Importerer…' : 'Importer medlemmer'}
              </Button>
              <Button
                disabled={pendingConflictCount === 0}
                onClick={() => {
                  setConflictIndex(0)
                  setConflictError(null)
                  setConflictResolverOpen(true)
                }}
                {...toolbarHelpProps('conflicts')}
              >
                Løs konflikter ({pendingConflictCount})
              </Button>
            </Frame>

            {importError ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000', flexShrink: 0 }}>
                {importError}
              </p>
            ) : null}

            <Frame display="flex" gap="$2" flexWrap="wrap" style={{ flexShrink: 0 }}>
              <Fieldset
                legend="Ventende avvik"
                style={{ padding: '8px 12px', minWidth: 160 }}
              >
                <p style={{ margin: 0, fontSize: 13 }}>
                  Totalt: <strong>{pendingConflictCount}</strong>
                </p>
                <p className="win95-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  {pendingConflicts} konflikter
                  {pendingPaymentWarnings > 0
                    ? ` (${pendingPaymentWarnings} betalingsadvarsler)`
                    : ''}{' '}
                  · {pendingFailures} feil
                </p>
              </Fieldset>
              <Fieldset
                legend="Siste import"
                style={{ padding: '8px 12px', flex: '1 1 220px' }}
              >
                {(() => {
                  const lastImport = importLog.find(
                    (e) => e.kind === 'import_completed',
                  )
                  return lastImport ? (
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.35 }}>
                      {lastImport.message}
                    </p>
                  ) : (
                    <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                      Ingen import kjørt ennå.
                    </p>
                  )
                })()}
              </Fieldset>
            </Frame>
            </Frame>

            <Fieldset
              legend="Venter på betalingsverifisering"
              style={{
                flex: '1 1 40%',
                minWidth: 280,
                minHeight: 0,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PendingPaymentVerificationPanel
                enabled={membersTab === 'Import og konflikter'}
              />
            </Fieldset>
          </Frame>
        </Tab>

        <Tab title="Logg">
          <Frame
            className="win95-admin-tab-body admin-members-tab admin-members-tab--log"
            display="flex"
            flexDirection="column"
            gap="$3"
            height="100%"
            style={{ minHeight: 0, overflow: 'auto' }}
          >
            <Fieldset legend="Importlogg" style={{ padding: '10px 12px' }}>
              <MemberImportLogPanel
                entries={importLog}
                onClear={clearImportLog}
              />
            </Fieldset>
            <Fieldset
              legend="Betalingslogg"
              style={{ padding: '10px 12px', flex: 1, minHeight: 0 }}
            >
              <PaymentChangeLogPanel enabled={membersTab === 'Logg'} />
            </Fieldset>
          </Frame>
        </Tab>
      </Tabs>
      </Frame>

      <Win95Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={isEdit ? 'Rediger medlem' : 'Nytt medlem'}
        width="440px"
        minHeight="420px"
      >
        <div className="win95-field">
          <label htmlFor="member-first-name">Fornavn</label>
          <Input
            id="member-first-name"
            value={form.firstName}
            onChange={(e) => setField('firstName', e.currentTarget.value)}
            placeholder="f.eks. Kari"
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field">
          <label htmlFor="member-last-name">Etternavn</label>
          <Input
            id="member-last-name"
            value={form.lastName}
            onChange={(e) => setField('lastName', e.currentTarget.value)}
            placeholder="f.eks. Nordmann"
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field">
          <label htmlFor="member-phone">Mobil</label>
          <Input
            id="member-phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.currentTarget.value)}
            type="tel"
            autoComplete="tel"
            placeholder="Valgfritt — f.eks. 91234567"
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field">
          <label htmlFor="member-email">E-post</label>
          <Input
            id="member-email"
            value={form.email}
            onChange={(e) => setField('email', e.currentTarget.value)}
            type="email"
            placeholder="f.eks. kari@example.com"
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field">
          <label htmlFor="member-address">Adresse</label>
          <Input
            id="member-address"
            value={form.address}
            onChange={(e) => setField('address', e.currentTarget.value)}
            placeholder="f.eks. Storgata 1"
            style={{ width: '100%' }}
          />
        </div>
        <Frame display="flex" gap="$2">
          <div className="win95-field" style={{ flex: 1 }}>
            <label htmlFor="member-postal">Postnr</label>
            <Input
              id="member-postal"
              value={form.postalCode}
              onChange={(e) => setField('postalCode', e.currentTarget.value)}
              placeholder="f.eks. 0155"
              style={{ width: '100%' }}
            />
          </div>
          <div className="win95-field" style={{ flex: 2 }}>
            <label htmlFor="member-city">Poststed</label>
            <Input
              id="member-city"
              value={form.city}
              onChange={(e) => setField('city', e.currentTarget.value)}
              placeholder="f.eks. Oslo"
              style={{ width: '100%' }}
            />
          </div>
        </Frame>
        <Frame display="flex" gap="$2">
          <div className="win95-field" style={{ flex: 1 }}>
            <label htmlFor="member-birth-year">Fødselsår</label>
            <Input
              id="member-birth-year"
              type="number"
              value={form.birthYear}
              onChange={(e) => setField('birthYear', e.currentTarget.value)}
              placeholder="f.eks. 1985"
              style={{ width: '100%' }}
            />
          </div>
          <div className="win95-field" style={{ flex: 2 }}>
            <label htmlFor="member-type">Type</label>
            <Input
              id="member-type"
              value={form.memberType}
              onChange={(e) => setField('memberType', e.currentTarget.value)}
              placeholder="f.eks. Ordinær"
              style={{ width: '100%' }}
            />
          </div>
        </Frame>
        <div className="win95-field">
          <label htmlFor="member-joined">Innmeldt</label>
          <Input
            id="member-joined"
            type="date"
            value={form.joinedAt}
            onChange={(e) => setField('joinedAt', e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
        <Frame display="flex" alignItems="center" gap="$2">
          <Checkbox
            checked={form.paid}
            onChange={(e) => setField('paid', e.currentTarget.checked)}
            id="member-paid"
          />
          <label htmlFor="member-paid">Har betalt i år</label>
        </Frame>
        <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
          Medlemmer som har betalt i år får tre ubrukte kuponger automatisk. Bruk
          «Registrer kupong» for å trekke dem.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setEditOpen(false)}>Avbryt</Button>
          <Button
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={memberToDelete !== null}
        onClose={() => setMemberToDelete(null)}
        title="Slett medlem"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette{' '}
          {memberToDelete
            ? `${memberToDelete.first_name} ${memberToDelete.last_name}`
            : ''}{' '}
          permanent? Dette kan ikke angres.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setMemberToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (!memberToDelete) return
              deleteMutation.mutate(memberToDelete.id)
            }}
          >
            {deleteMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        title="Slett alle medlemmer"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette alle {memberCount} medlemmer permanent? Kuponger og
          betalingsdata slettes også. Dette kan ikke angres.
        </p>
        <p className="win95-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Kun for utvikling / ny import.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setDeleteAllOpen(false)}>Avbryt</Button>
          <Button
            disabled={deleteAllMutation.isPending}
            onClick={() => deleteAllMutation.mutate()}
          >
            {deleteAllMutation.isPending ? 'Sletter…' : 'Slett alle'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={refreshOpen}
        onClose={() => setRefreshOpen(false)}
        title="Oppfrisk årskuponger"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Alle medlemmer som har betalt i år får nye ubrukte kuponger iht.
          innstillingen under Organisasjon (gamle ubrukte erstattes). Brukte
          kuponger med tidspunkt beholdes i historikken.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setRefreshOpen(false)}>Avbryt</Button>
          <Button
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate()}
          >
            {refreshMutation.isPending ? 'Oppfrisker…' : 'Bekreft'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95CopyProgressDialog
        open={importProgress !== null}
        title="Importerer medlemmer…"
        fromLabel={importProgress?.fromLabel ?? ''}
        toLabel="Medlemsdatabase"
        statusText={importProgress?.statusText ?? ''}
        percent={importProgress?.percent ?? 0}
      />

      <Win95Dialog
        open={importSummary !== null}
        onClose={() => {
          setImportSummary(null)
        }}
        title="Import fullført"
        width="420px"
      >
        {importSummary ? (
          <>
            <p style={{ margin: 0, fontSize: 13 }}>
              Linjer i import: <strong>{importSummary.linesProcessed}</strong>
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Allerede i systemet: <strong>{importSummary.alreadyInSystem}</strong>
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Nye lagt til: <strong>{importSummary.newlyAdded}</strong>
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Betalt medlemskap fra lista:{' '}
              <strong>{importSummary.membershipPaidFromSheet}</strong>
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Konflikter: <strong>{importSummary.conflictsFound}</strong>
              {importSummary.conflictsFound > 0 ? (
                <span className="win95-muted" style={{ marginLeft: 6 }}>
                  (se «Løs konflikter»)
                </span>
              ) : null}
            </p>
            {importSummary.errorCount > 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
                Feilede rader: <strong>{importSummary.errorCount}</strong>
                <span className="win95-muted" style={{ marginLeft: 6 }}>
                  (se «Løs konflikter»)
                </span>
              </p>
            ) : null}
            <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
              <Button
                onClick={() => {
                  setImportSummary(null)
                }}
              >
                Lukk
              </Button>
            </Frame>
          </>
        ) : null}
      </Win95Dialog>

      <Win95Dialog
        open={conflictResolverOpen && activeReviewItem !== null}
        onClose={() => {
          setConflictResolverOpen(false)
          setConflictError(null)
        }}
        title={
          activeFailure
            ? `Feilet import ${conflictIndex + 1} av ${conflictQueue.length}`
            : activePaymentWarning
              ? `Betalingsadvarsel ${conflictIndex + 1} av ${conflictQueue.length}`
              : `Konflikt ${conflictIndex + 1} av ${conflictQueue.length}`
        }
        width="560px"
        minHeight="360px"
      >
        {activeFailure ? (
          <>
            <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
              Denne raden ble ikke importert. Les feilen, og merk den som forstått
              når du er ferdig.
            </p>
            <dl className="win95-member-facts">
              <dt>Linje</dt>
              <dd>{activeFailure.lineNumber || '—'}</dd>
              <dt>Navn</dt>
              <dd>
                {[activeFailure.firstName, activeFailure.lastName]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </dd>
              <dt>ID</dt>
              <dd>{activeFailure.externalId || '—'}</dd>
              <dt>Mobil</dt>
              <dd>{activeFailure.phone || '—'}</dd>
              <dt>Feil</dt>
              <dd style={{ color: '#c00000' }}>{activeFailure.message}</dd>
            </dl>
            <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
              <Button onClick={acknowledgeFailure}>Merk som forstått</Button>
            </Frame>
          </>
        ) : activeConflict ? (
          <>
            {activePaymentWarning ? (
              <p style={{ margin: 0, fontSize: 12, color: '#8a6d00' }}>
                Betalt i systemet, men ikke i medlemslista. Noen kan ha sagt at de
                skal betale uten at det er registrert, eller det kan være forsinkelse.
                «Bruk CSV» fjerner betaling; «Behold» beholder betalt-status.
              </p>
            ) : (
              <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                Felt som avviker er markert. Velg om du beholder eksisterende data,
                bruker CSV, eller hopper over.
              </p>
            )}
            <div
              style={{
                maxHeight: 280,
                overflow: 'auto',
                border: '2px solid #808080',
                background: '#fff',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: '#c0c0c0' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Felt</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>
                      Eksisterende
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>CSV</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictFields.map((f) => (
                    <tr
                      key={f.label}
                      style={{
                        background: f.differs ? '#ffffcc' : '#fff',
                      }}
                    >
                      <td style={{ padding: '4px 6px', fontWeight: f.differs ? 600 : 400 }}>
                        {f.label}
                      </td>
                      <td style={{ padding: '4px 6px' }}>{f.existing}</td>
                      <td style={{ padding: '4px 6px' }}>{f.csv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {conflictError ? (
              <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
                {conflictError}
              </p>
            ) : null}
            <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2" flexWrap="wrap">
              <Button
                disabled={conflictBusy}
                onClick={() => void resolveConflict('skip')}
              >
                Hopp over
              </Button>
              <Button
                disabled={conflictBusy}
                onClick={() => void resolveConflict('keep')}
              >
                Behold eksisterende
              </Button>
              <Button
                disabled={conflictBusy}
                onClick={() => void resolveConflict('use_csv')}
              >
                {conflictBusy ? 'Lagrer…' : 'Bruk CSV'}
              </Button>
            </Frame>
          </>
        ) : null}
      </Win95Dialog>
    </Frame>
  )
}
