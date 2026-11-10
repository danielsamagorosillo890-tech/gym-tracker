import { describe, expect, it } from 'vitest';
import { parseDecimal } from './number';

describe('parseDecimal', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseDecimal('62.5')).toBe(62.5);
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal(' 8 ')).toBe(8);
  });
  it('rejects empty or invalid input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1.2.3')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
  });
});
