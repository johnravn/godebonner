import { describe, expect, it, beforeEach } from 'vitest'
import {
  createImportCompletedLogEntry,
  createReviewClearedLogEntry,
  loadMemberImportLog,
  persistMemberImportLog,
} from '#/features/admin/member-import-log'

describe('member-import-log', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists and loads entries', () => {
    const entry = createImportCompletedLogEntry({
      fileName: 'medlemmer.csv',
      linesProcessed: 10,
      newlyAdded: 4,
      alreadyInSystem: 3,
      conflictsFound: 2,
      errorCount: 1,
    })
    persistMemberImportLog([entry])
    const loaded = loadMemberImportLog()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].message).toMatch(/medlemmer\.csv/)
    expect(loaded[0].newlyAdded).toBe(4)
    expect(loaded[0].membershipPaidFromSheet).toBe(0)
    expect(loaded[0].message).toMatch(/0 betalt medlemskap/)
  })

  it('creates a review-cleared message', () => {
    const entry = createReviewClearedLogEntry({ fileName: 'x.csv' })
    expect(entry.kind).toBe('review_cleared')
    expect(entry.message).toMatch(/håndtert/)
  })
})
