/**
 * Normalizes a phone number to digit-only storage, matching
 * `public.normalize_member_phone` in the database.
 * Norwegian mobiles are kept as 8 digits (leading 47/047 is stripped).
 */
export function normalizeMemberPhone(input: string): string | null {
  const digits = input.trim().replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 && digits.startsWith('47')) {
    return digits.slice(2)
  }
  if (digits.length === 11 && digits.startsWith('047')) {
    return digits.slice(3)
  }
  return digits
}
