import { describe, expect, it } from 'vitest'
import {
  buildConflictFieldRows,
  classifyMemberImport,
  CURRENT_PAYMENT_YEAR,
  differingFields,
  displayValue,
  findMatchingMember,
  parseMemberCsv,
  PREVIOUS_PAYMENT_YEAR,
  type ExistingMemberForImport,
  type ParsedMemberCsvRow,
} from './member-csv-import'

const header =
  'ID;Fornavn;Etternavn;Adresse;Postnr;Poststed;Mobil;Epost;Fødselsår;Type;Innmeldt;Bet. 2026;Bet. 25 i fjor'

function baseExisting(
  overrides: Partial<ExistingMemberForImport> = {},
): ExistingMemberForImport {
  return {
    id: 'm1',
    external_id: '100',
    first_name: 'Ada',
    last_name: 'Lovelace',
    address: null,
    postal_code: null,
    city: null,
    phone: '91234567',
    email: null,
    birth_year: null,
    member_type: null,
    joined_at: null,
    paid: true,
    payments: [
      { year: CURRENT_PAYMENT_YEAR, paid: true },
      { year: PREVIOUS_PAYMENT_YEAR, paid: false },
    ],
    ...overrides,
  }
}

describe('parseMemberCsv', () => {
  it('rejects empty files', () => {
    const { rows, errors } = parseMemberCsv('   \n  ')
    expect(rows).toEqual([])
    expect(errors[0]?.message).toMatch(/tom/i)
  })

  it('requires Fornavn and Etternavn headers', () => {
    const { rows, errors } = parseMemberCsv('Mobil;Epost\n91234567;a@b.c')
    expect(rows).toEqual([])
    expect(errors[0]?.message).toMatch(/Mangler kolonne/)
  })

  it('parses semicolon CSV with payment flags and dates', () => {
    const csv = `${header}
100;Ada;Lovelace;Gate 1;0123;Oslo;912 34 567;ada@example.com;1990;Æres;15.12.2020;ja;nei
`
    const { rows, errors } = parseMemberCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      externalId: '100',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '91234567',
      birthYear: 1990,
      joinedAt: '2020-12-15',
      paid: true,
    })
    expect(rows[0].payments).toEqual([
      { year: CURRENT_PAYMENT_YEAR, paid: true },
      { year: PREVIOUS_PAYMENT_YEAR, paid: false },
    ])
  })

  it('detects comma delimiter and strips BOM', () => {
    const csv =
      '\uFEFFID,Fornavn,Etternavn,Mobil,Bet. 2026\n1,Ola,Nordmann,99887766,1\n'
    const { rows, errors } = parseMemberCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0].firstName).toBe('Ola')
    expect(rows[0].phone).toBe('99887766')
    expect(rows[0].paid).toBe(true)
  })

  it('handles quoted fields with delimiters', () => {
    const csv = `${header}
;Kari;"Nordmann; Jr";"";"";"";91111111;;;;;;;;;
`
    const { rows, errors } = parseMemberCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0].lastName).toBe('Nordmann; Jr')
  })

  it('treats non-empty unknown payment cells as paid', () => {
    const csv = `${header}
;Per;Hansen;;;;;;;2020;;250 kr;x
`
    const { rows } = parseMemberCsv(csv)
    expect(rows[0].paid).toBe(true)
    expect(rows[0].payments[1].paid).toBe(true)
  })

  it('parses YYYY and ISO joined dates', () => {
    const csv = `${header}
;A;B;;;;;;;;2024;;
;C;D;;;;;;;;2023-06-01;;
`
    const { rows } = parseMemberCsv(csv)
    expect(rows[0].joinedAt).toBe('2024-01-01')
    expect(rows[1].joinedAt).toBe('2023-06-01')
  })

  it('skips blank name rows and errors on partial names', () => {
    const csv = `${header}
;;;;;;;;;
;Only;;
`
    const { rows, errors } = parseMemberCsv(csv)
    expect(rows).toEqual([])
    expect(errors.some((e) => e.message.includes('påkrevd'))).toBe(true)
    expect(errors.find((e) => e.message.includes('påkrevd'))).toMatchObject({
      firstName: 'Only',
      lastName: null,
    })
  })
})

describe('findMatchingMember / differingFields / classifyMemberImport', () => {
  it('matches by external id only when ID is present', () => {
    const existing = baseExisting()
    const byId = new Map([['100', existing]])
    const byPhone = new Map([['91234567', [existing]]])
    const csv: ParsedMemberCsvRow = {
      lineNumber: 2,
      externalId: '100',
      firstName: 'Ada',
      lastName: 'Lovelace',
      address: null,
      postalCode: null,
      city: null,
      phone: '99999999',
      email: null,
      birthYear: null,
      memberType: null,
      joinedAt: null,
      payments: existing.payments,
      paid: true,
    }
    expect(findMatchingMember(csv, byId, byPhone)).toEqual({
      kind: 'match',
      member: existing,
    })
    expect(
      findMatchingMember(
        { ...csv, externalId: null, phone: '91234567' },
        new Map(),
        byPhone,
      ),
    ).toEqual({ kind: 'match', member: existing })
    expect(
      findMatchingMember(
        { ...csv, externalId: null, phone: null },
        byId,
        byPhone,
      ),
    ).toEqual({ kind: 'none' })
  })

  it('does not match by phone when CSV has a new external id', () => {
    const existing = baseExisting()
    const byId = new Map([['100', existing]])
    const byPhone = new Map([['91234567', [existing]]])
    const result = findMatchingMember(
      {
        lineNumber: 2,
        externalId: '999',
        firstName: 'New',
        lastName: 'Person',
        address: null,
        postalCode: null,
        city: null,
        phone: '91234567',
        email: null,
        birthYear: null,
        memberType: null,
        joinedAt: null,
        payments: [
          { year: CURRENT_PAYMENT_YEAR, paid: false },
          { year: PREVIOUS_PAYMENT_YEAR, paid: false },
        ],
        paid: false,
      },
      byId,
      byPhone,
    )
    expect(result).toEqual({ kind: 'none' })
  })

  it('reports ambiguous phone when several members share a number and CSV has no ID', () => {
    const a = baseExisting({ id: 'm1', external_id: '100' })
    const b = baseExisting({
      id: 'm2',
      external_id: '200',
      first_name: 'Other',
    })
    const byPhone = new Map([['91234567', [a, b]]])
    expect(
      findMatchingMember(
        {
          lineNumber: 2,
          externalId: null,
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
          payments: a.payments,
          paid: true,
        },
        new Map(),
        byPhone,
      ),
    ).toEqual({ kind: 'ambiguous_phone' })
  })

  it('allows two CSV rows with the same phone and different IDs', () => {
    const result = classifyMemberImport(
      [
        {
          lineNumber: 2,
          externalId: '101',
          firstName: 'Ada',
          lastName: 'One',
          address: null,
          postalCode: null,
          city: null,
          phone: '91234567',
          email: null,
          birthYear: null,
          memberType: null,
          joinedAt: null,
          payments: [
            { year: CURRENT_PAYMENT_YEAR, paid: false },
            { year: PREVIOUS_PAYMENT_YEAR, paid: false },
          ],
          paid: false,
        },
        {
          lineNumber: 3,
          externalId: '102',
          firstName: 'Bob',
          lastName: 'Two',
          address: null,
          postalCode: null,
          city: null,
          phone: '91234567',
          email: null,
          birthYear: null,
          memberType: null,
          joinedAt: null,
          payments: [
            { year: CURRENT_PAYMENT_YEAR, paid: false },
            { year: PREVIOUS_PAYMENT_YEAR, paid: false },
          ],
          paid: false,
        },
      ],
      [],
    )
    expect(result.errors).toEqual([])
    expect(result.toInsert.map((r) => r.externalId)).toEqual(['101', '102'])
  })

  it('errors when phone-only row matches several existing members', () => {
    const existing = [
      baseExisting({ id: 'm1', external_id: '100' }),
      baseExisting({
        id: 'm2',
        external_id: '200',
        first_name: 'Other',
      }),
    ]
    const result = classifyMemberImport(
      [
        {
          lineNumber: 2,
          externalId: null,
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
          payments: existing[0].payments,
          paid: true,
        },
      ],
      existing,
    )
    expect(result.toInsert).toEqual([])
    expect(result.errors[0]?.message).toMatch(/Flere medlemmer har mobil/)
  })

  it('classifies insert, skip, conflict, and duplicate errors', () => {
    const existing = [
      baseExisting(),
      baseExisting({
        id: 'm2',
        external_id: '200',
        phone: '90000000',
        first_name: 'Other',
      }),
    ]
    const csvRows: ParsedMemberCsvRow[] = [
      {
        lineNumber: 2,
        externalId: '100',
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
          { year: CURRENT_PAYMENT_YEAR, paid: true },
          { year: PREVIOUS_PAYMENT_YEAR, paid: false },
        ],
        paid: true,
      },
      {
        lineNumber: 3,
        externalId: '100',
        firstName: 'Ada',
        lastName: 'Changed',
        address: null,
        postalCode: null,
        city: null,
        phone: '91234567',
        email: null,
        birthYear: null,
        memberType: null,
        joinedAt: null,
        payments: [
          { year: CURRENT_PAYMENT_YEAR, paid: true },
          { year: PREVIOUS_PAYMENT_YEAR, paid: false },
        ],
        paid: true,
      },
      {
        lineNumber: 4,
        externalId: '999',
        firstName: 'New',
        lastName: 'Member',
        address: null,
        postalCode: null,
        city: null,
        phone: null,
        email: null,
        birthYear: null,
        memberType: null,
        joinedAt: null,
        payments: [
          { year: CURRENT_PAYMENT_YEAR, paid: false },
          { year: PREVIOUS_PAYMENT_YEAR, paid: false },
        ],
        paid: false,
      },
      {
        lineNumber: 5,
        externalId: null,
        firstName: 'No',
        lastName: 'Keys',
        address: null,
        postalCode: null,
        city: null,
        phone: null,
        email: null,
        birthYear: null,
        memberType: null,
        joinedAt: null,
        payments: [
          { year: CURRENT_PAYMENT_YEAR, paid: false },
          { year: PREVIOUS_PAYMENT_YEAR, paid: false },
        ],
        paid: false,
      },
    ]

    const result = classifyMemberImport(csvRows, existing)
    expect(result.skipped).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
    // Line 3 is duplicate id in file after line 2 claimed it
    const dupError = result.errors.find((e) =>
      e.message.includes('Duplikat ID'),
    )
    expect(dupError).toMatchObject({
      lineNumber: 3,
      firstName: 'Ada',
      lastName: 'Changed',
      externalId: '100',
    })
    expect(result.toInsert.map((r) => r.externalId)).toContain('999')
    const missingKeys = result.errors.find((e) =>
      e.message.includes('Mangler mobil og ID'),
    )
    expect(missingKeys).toMatchObject({
      firstName: 'No',
      lastName: 'Keys',
      phone: null,
      externalId: null,
    })

    const conflictCsv: ParsedMemberCsvRow = {
      ...csvRows[0],
      lastName: 'Different',
    }
    const conflicted = classifyMemberImport([conflictCsv], [existing[0]])
    expect(conflicted.conflicts).toHaveLength(1)
    expect(conflicted.conflicts[0].differingFields).toContain('Etternavn')

    const diffs = differingFields(existing[0], conflictCsv)
    expect(diffs).toContain('Etternavn')

    const rows = buildConflictFieldRows(conflicted.conflicts[0])
    expect(rows.find((r) => r.label === 'Etternavn')?.differs).toBe(true)
  })

  it('displayValue shows em dash for empty', () => {
    expect(displayValue(null)).toBe('—')
    expect(displayValue('')).toBe('—')
    expect(displayValue(12)).toBe('12')
  })

  it('auto-applies current-year paid-only when sheet says paid and DB unpaid', () => {
    const existing = baseExisting({
      paid: false,
      payments: [
        { year: CURRENT_PAYMENT_YEAR, paid: false },
        { year: PREVIOUS_PAYMENT_YEAR, paid: false },
      ],
    })
    const csv: ParsedMemberCsvRow = {
      lineNumber: 2,
      externalId: '100',
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
        { year: CURRENT_PAYMENT_YEAR, paid: true },
        { year: PREVIOUS_PAYMENT_YEAR, paid: false },
      ],
      paid: true,
    }
    const result = classifyMemberImport([csv], [existing])
    expect(result.autoPaidFromSheet).toHaveLength(1)
    expect(result.paymentWarnings).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('warns when current-year paid-only and sheet says unpaid but DB paid', () => {
    const existing = baseExisting({
      paid: true,
      payments: [
        { year: CURRENT_PAYMENT_YEAR, paid: true },
        { year: PREVIOUS_PAYMENT_YEAR, paid: false },
      ],
    })
    const csv: ParsedMemberCsvRow = {
      lineNumber: 2,
      externalId: '100',
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
        { year: CURRENT_PAYMENT_YEAR, paid: false },
        { year: PREVIOUS_PAYMENT_YEAR, paid: false },
      ],
      paid: false,
    }
    const result = classifyMemberImport([csv], [existing])
    expect(result.paymentWarnings).toHaveLength(1)
    expect(result.autoPaidFromSheet).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('keeps mixed diffs (name + paid) in normal conflicts', () => {
    const existing = baseExisting({
      paid: false,
      payments: [
        { year: CURRENT_PAYMENT_YEAR, paid: false },
        { year: PREVIOUS_PAYMENT_YEAR, paid: false },
      ],
    })
    const csv: ParsedMemberCsvRow = {
      lineNumber: 2,
      externalId: '100',
      firstName: 'Ada',
      lastName: 'Different',
      address: null,
      postalCode: null,
      city: null,
      phone: '91234567',
      email: null,
      birthYear: null,
      memberType: null,
      joinedAt: null,
      payments: [
        { year: CURRENT_PAYMENT_YEAR, paid: true },
        { year: PREVIOUS_PAYMENT_YEAR, paid: false },
      ],
      paid: true,
    }
    const result = classifyMemberImport([csv], [existing])
    expect(result.conflicts).toHaveLength(1)
    expect(result.autoPaidFromSheet).toHaveLength(0)
    expect(result.paymentWarnings).toHaveLength(0)
  })
})
