import type { Contact } from '@/types';

const NOISE = /\b(pvt|private|ltd|limited|plc|co|company|mr|mrs|ms|miss|dr|messrs|m\/s|and|&)\b/g;

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[().,]/g, ' ')
    .replace(NOISE, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t)).length;
  return shared / Math.max(a.length, b.length);
}

/**
 * The contact a name read off a document refers to, matched on display or
 * company name. Only returns a match that is clearly better than the rest.
 */
export function matchContact<C extends Pick<Contact, 'id' | 'displayName' | 'companyName'>>(
  name: string | undefined,
  contacts: readonly C[],
): C | undefined {
  if (!name) return undefined;
  const wanted = tokens(name);
  if (!wanted.length) return undefined;
  const scored = contacts
    .map((c) => ({
      contact: c,
      score: Math.max(
        similarity(wanted, tokens(c.displayName)),
        c.companyName ? similarity(wanted, tokens(c.companyName)) : 0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  if (!first || first.score < 0.5) return undefined;
  if (second && second.score >= first.score - 0.15) return undefined;
  return first.contact;
}
