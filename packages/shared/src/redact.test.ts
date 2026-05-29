import { describe, it, expect } from 'vitest';
import { redactPii } from './redact.js';

describe('redactPii', () => {
  it('redacts email addresses', () => {
    expect(redactPii('reach me at jane.doe+test@example.co.uk please')).toBe(
      'reach me at [REDACTED_EMAIL] please',
    );
  });

  it('redacts API keys (OpenAI / OpenRouter style)', () => {
    expect(redactPii('key=sk-or-v1-abcdef0123456789abcdef0123')).toContain('[REDACTED_API_KEY]');
    expect(redactPii('sk-abcdefghijklmnop1234')).toBe('[REDACTED_API_KEY]');
  });

  it('redacts AWS access key ids', () => {
    expect(redactPii('AKIAIOSFODNN7EXAMPLE here')).toBe('[REDACTED_AWS_KEY] here');
  });

  it('redacts bearer tokens', () => {
    expect(redactPii('Authorization: Bearer abc.def.ghi')).toContain('[REDACTED_BEARER]');
  });

  it('redacts SSNs', () => {
    expect(redactPii('ssn 123-45-6789')).toBe('ssn [REDACTED_SSN]');
  });

  it('redacts a Luhn-valid credit card (with separators)', () => {
    // 4242 4242 4242 4242 is a valid Luhn test card.
    expect(redactPii('card 4242 4242 4242 4242 ok')).toBe('card [REDACTED_CARD] ok');
  });

  it('redacts phone numbers including country code', () => {
    expect(redactPii('call +91 90297 22073 tomorrow')).toBe('call [REDACTED_PHONE] tomorrow');
  });

  // ── negatives: ordinary text must survive untouched ──────────────────────────
  it('leaves plain prose untouched', () => {
    const s = 'The quick brown fox jumped over 3 lazy dogs.';
    expect(redactPii(s)).toBe(s);
  });

  it('does not treat a semver or short id as a phone', () => {
    expect(redactPii('version 1.2.3 build 42')).toBe('version 1.2.3 build 42');
    expect(redactPii('order #12345')).toBe('order #12345');
  });

  it('does not redact a random 16-digit number that fails Luhn', () => {
    expect(redactPii('id 1234567812345678')).toBe('id 1234567812345678');
  });

  it('returns empty/whitespace inputs unchanged', () => {
    expect(redactPii('')).toBe('');
    expect(redactPii('   ')).toBe('   ');
  });
});
