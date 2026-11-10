/**
 * Parses a user-typed number accepting both "." and "," as decimal separator.
 * Returns null for empty or invalid input.
 */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '' || !/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
