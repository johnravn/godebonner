export type MemberImportLogKind =
  | 'import_completed'
  | 'review_cleared'

export type MemberImportLogEntry = {
  id: string
  at: string
  kind: MemberImportLogKind
  message: string
  fileName?: string
  linesProcessed?: number
  newlyAdded?: number
  alreadyInSystem?: number
  conflictsFound?: number
  errorCount?: number
  membershipPaidFromSheet?: number
}

const STORAGE_KEY = 'godebonner.member-import-log'
const MAX_ENTRIES = 80

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function loadMemberImportLog(): MemberImportLogEntry[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isImportLogEntry).slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function isImportLogEntry(value: unknown): value is MemberImportLogEntry {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.at === 'string' &&
    typeof row.kind === 'string' &&
    typeof row.message === 'string'
  )
}

export function persistMemberImportLog(entries: MemberImportLogEntry[]): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function createImportCompletedLogEntry(input: {
  fileName: string
  linesProcessed: number
  newlyAdded: number
  alreadyInSystem: number
  conflictsFound: number
  errorCount: number
  membershipPaidFromSheet?: number
}): MemberImportLogEntry {
  const parts = [
    `${input.newlyAdded} nye`,
    `${input.alreadyInSystem} allerede i systemet`,
    `${input.membershipPaidFromSheet ?? 0} betalt medlemskap`,
    `${input.conflictsFound} konflikter`,
    `${input.errorCount} feil`,
  ]
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind: 'import_completed',
    fileName: input.fileName,
    linesProcessed: input.linesProcessed,
    newlyAdded: input.newlyAdded,
    alreadyInSystem: input.alreadyInSystem,
    conflictsFound: input.conflictsFound,
    errorCount: input.errorCount,
    membershipPaidFromSheet: input.membershipPaidFromSheet ?? 0,
    message: `Import av «${input.fileName}»: ${parts.join(', ')} (${input.linesProcessed} linjer).`,
  }
}

export function createReviewClearedLogEntry(input?: {
  fileName?: string
}): MemberImportLogEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind: 'review_cleared',
    fileName: input?.fileName,
    message: input?.fileName
      ? `Alle importavvik for «${input.fileName}» er håndtert.`
      : 'Alle ventende importavvik er håndtert.',
  }
}

export function formatImportLogTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}
