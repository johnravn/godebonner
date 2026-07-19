import { describe, expect, it } from 'vitest'
import {
  PAYMENT_CHANGE_LOG_CSV_HEADERS,
  paymentChangeLogToCsv,
  type PaymentChangeLogRow,
} from './payment-change-log'

const sample: PaymentChangeLogRow = {
  id: 'log-1',
  created_at: '2026-07-18T12:30:00.000Z',
  member_id: 'm1',
  member_first_name: 'Ada',
  member_last_name: 'Lovelace',
  member_phone: '91234567',
  member_external_id: '42',
  year: 2026,
  paid: true,
  previous_paid: false,
  changed_by: 'u1',
  changed_by_email: 'admin@test.local',
}

describe('paymentChangeLogToCsv', () => {
  it('exports semicolon CSV with Norwegian headers', () => {
    const csv = paymentChangeLogToCsv([sample])
    const [header, row] = csv.trimEnd().split('\n')
    expect(header).toBe(PAYMENT_CHANGE_LOG_CSV_HEADERS.join(';'))
    expect(row).toBe(
      '2026-07-18T12:30:00.000Z;2026;Ada Lovelace;91234567;42;Ikke betalt;Betalt;admin@test.local',
    )
  })

  it('escapes values that contain semicolons or quotes', () => {
    const csv = paymentChangeLogToCsv([
      {
        ...sample,
        member_last_name: 'Nord;mann',
        changed_by_email: 'a"b@test.local',
      },
    ])
    expect(csv).toContain('"Ada Nord;mann"')
    expect(csv).toContain('"a""b@test.local"')
  })
})
