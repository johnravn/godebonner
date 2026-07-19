import { CURRENT_PAYMENT_YEAR } from '#/features/admin/member-csv-import'
import type { ParsedMemberCsvRow } from '#/features/admin/member-csv-import'

export type PendingVerificationRow = {
  member_id: string
  year: number
  marked_paid_at: string
  imports_without_verification: number
  last_import_missed_at: string | null
  member_first_name: string
  member_last_name: string
  member_phone: string | null
  created_at: string
}

export type PaymentVerificationSyncPlan = {
  /** Pending member IDs confirmed paid in this CSV import — remove from pending. */
  toVerify: string[]
  /** Pending member IDs not confirmed paid — bump miss counter. */
  toBump: string[]
}

/**
 * Given pending verification member IDs and the set of member IDs confirmed
 * paid for the current year in this import, decide who to verify vs bump.
 */
export function planPaymentVerificationSync(
  pendingMemberIds: string[],
  csvConfirmedPaidMemberIds: ReadonlySet<string>,
): PaymentVerificationSyncPlan {
  const toVerify: string[] = []
  const toBump: string[] = []
  for (const id of pendingMemberIds) {
    if (csvConfirmedPaidMemberIds.has(id)) toVerify.push(id)
    else toBump.push(id)
  }
  return { toVerify, toBump }
}

/**
 * Collect member IDs that matched a CSV row with current-year paid=true.
 * Includes skipped, auto-paid, conflicts, and payment warnings when CSV says paid.
 */
export function collectCsvConfirmedPaidMemberIds(
  matchedRows: Array<{ memberId: string; csv: ParsedMemberCsvRow }>,
): Set<string> {
  const confirmed = new Set<string>()
  for (const { memberId, csv } of matchedRows) {
    const currentYear = csv.payments.find((p) => p.year === CURRENT_PAYMENT_YEAR)
    if (currentYear?.paid ?? csv.paid) {
      confirmed.add(memberId)
    }
  }
  return confirmed
}

export function formatPendingMemberName(row: {
  member_first_name: string
  member_last_name: string
}): string {
  return `${row.member_first_name} ${row.member_last_name}`.trim()
}
