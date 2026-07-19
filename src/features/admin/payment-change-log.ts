export type PaymentChangeLogRow = {
  id: string
  created_at: string
  member_id: string | null
  member_first_name: string
  member_last_name: string
  member_phone: string | null
  member_external_id: string | null
  year: number
  paid: boolean
  previous_paid: boolean | null
  changed_by: string | null
  changed_by_email: string | null
}

export const PAYMENT_CHANGE_LOG_CSV_HEADERS = [
  'Tidspunkt',
  'År',
  'Medlem',
  'Telefon',
  'Ekstern ID',
  'Tidligere',
  'Ny status',
  'Bruker',
] as const

function csvEscape(value: string): string {
  if (/[\";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function paidLabel(paid: boolean | null | undefined): string {
  if (paid == null) return ''
  return paid ? 'Betalt' : 'Ikke betalt'
}

export function formatPaymentChangeMemberName(row: PaymentChangeLogRow): string {
  return `${row.member_first_name} ${row.member_last_name}`.trim()
}

/** Semicolon-separated CSV for Excel / Numbers (nb-NO). */
export function paymentChangeLogToCsv(rows: PaymentChangeLogRow[]): string {
  const lines = [
    PAYMENT_CHANGE_LOG_CSV_HEADERS.join(';'),
    ...rows.map((row) =>
      [
        row.created_at,
        String(row.year),
        formatPaymentChangeMemberName(row),
        row.member_phone ?? '',
        row.member_external_id ?? '',
        paidLabel(row.previous_paid),
        paidLabel(row.paid),
        row.changed_by_email ?? '',
      ]
        .map(csvEscape)
        .join(';'),
    ),
  ]
  return `${lines.join('\n')}\n`
}

export function downloadPaymentChangeLogCsv(
  rows: PaymentChangeLogRow[],
  filename = `betalingslogg-${new Date().toISOString().slice(0, 10)}.csv`,
): void {
  const csv = paymentChangeLogToCsv(rows)
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
