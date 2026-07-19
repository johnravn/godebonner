import { describe, expect, it } from 'vitest'
import {
  collectCsvConfirmedPaidMemberIds,
  planPaymentVerificationSync,
} from './payment-verification'
import { CURRENT_PAYMENT_YEAR, PREVIOUS_PAYMENT_YEAR } from './member-csv-import'
import type { ParsedMemberCsvRow } from './member-csv-import'

function csvRow(
  overrides: Partial<ParsedMemberCsvRow> & { paid: boolean },
): ParsedMemberCsvRow {
  return {
    lineNumber: 2,
    externalId: '1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    address: null,
    postalCode: null,
    city: null,
    phone: '91234567',
    email: null,
    birthYear: null,
    memberType: null,
    joinedAt: null,
    payments: [
      { year: CURRENT_PAYMENT_YEAR, paid: overrides.paid },
      { year: PREVIOUS_PAYMENT_YEAR, paid: false },
    ],
    ...overrides,
  }
}

describe('planPaymentVerificationSync', () => {
  it('verifies confirmed members and bumps the rest', () => {
    const plan = planPaymentVerificationSync(
      ['a', 'b', 'c'],
      new Set(['b']),
    )
    expect(plan.toVerify).toEqual(['b'])
    expect(plan.toBump).toEqual(['a', 'c'])
  })

  it('bumps everyone when nothing is confirmed', () => {
    const plan = planPaymentVerificationSync(['a', 'b'], new Set())
    expect(plan.toVerify).toEqual([])
    expect(plan.toBump).toEqual(['a', 'b'])
  })
})

describe('collectCsvConfirmedPaidMemberIds', () => {
  it('includes only rows with current-year paid', () => {
    const ids = collectCsvConfirmedPaidMemberIds([
      { memberId: 'm1', csv: csvRow({ paid: true }) },
      { memberId: 'm2', csv: csvRow({ paid: false }) },
    ])
    expect([...ids]).toEqual(['m1'])
  })
})
