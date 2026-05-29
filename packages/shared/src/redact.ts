// PII redaction for stored previews. Regex-based and best-effort by design — the README
// documents the tradeoff (vs an NER model for names). Two deliberate choices:
//   1. Order: secrets and credit cards are redacted BEFORE the looser phone matcher, so a
//      bare card number isn't swallowed and mislabeled as a phone.
//   2. Luhn check on card candidates, so a random 16-digit id isn't redacted as a card.

const SIMPLE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // OpenAI / OpenRouter / Stripe-style keys: sk-..., sk-or-v1-..., pk-..., rk-...
  // Hyphens allowed inside the token so multi-segment prefixes (sk-or-v1-) match whole.
  { label: 'API_KEY', re: /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}/gi },
  { label: 'AWS_KEY', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: 'BEARER', re: /\bBearer\s+[A-Za-z0-9._-]+/gi },
  { label: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
];

// Separators only BETWEEN digits (never trailing), so a match never eats the following space.
const CARD_CANDIDATE = /\b\d(?:[ -]?\d){12,18}\b/g; // 13–19 digits
// Lookarounds keep the match from biting into a longer digit run (e.g. a bare 16-digit id)
// and from matching a version/decimal, while still allowing a leading + and separators.
const PHONE_CANDIDATE = /(?<![\d.])\+?\d(?:[\s().-]?\d){9,14}(?![\d])/g; // 10–15 digits

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48; // '0' = 48
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function countDigits(s: string): number {
  let c = 0;
  for (let i = 0; i < s.length; i++) {
    const d = s.charCodeAt(i);
    if (d >= 48 && d <= 57) c++;
  }
  return c;
}

/**
 * Redact common PII/secrets from a string. Returns the string with matches replaced by
 * `[REDACTED_<LABEL>]`. Pure function — callers decide whether to invoke it (see
 * {@link isRedactionEnabled}).
 */
export function redactPii(input: string): string {
  if (!input) return input;
  let out = input;

  for (const { label, re } of SIMPLE_PATTERNS) {
    out = out.replace(re, `[REDACTED_${label}]`);
  }

  // Credit cards: only redact candidates that pass Luhn (13–19 digits).
  out = out.replace(CARD_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      return '[REDACTED_CARD]';
    }
    return match;
  });

  // Phones: redact candidates with a plausible 10–15 digit count (after cards are gone).
  out = out.replace(PHONE_CANDIDATE, (match) => {
    const n = countDigits(match);
    return n >= 10 && n <= 15 ? '[REDACTED_PHONE]' : match;
  });

  return out;
}

/** Whether redaction is enabled (default ON; disable with REDACT_PII=false). */
export function isRedactionEnabled(): boolean {
  return process.env.REDACT_PII !== 'false';
}

/** Redact only if enabled — convenience for the worker. */
export function redactIfEnabled(input: string): string {
  return isRedactionEnabled() ? redactPii(input) : input;
}
