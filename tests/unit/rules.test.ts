import { describe, expect, it } from 'vitest';
import { errorMessage, isAdminEmail, isCompanyEmail, stableShuffle, voteButton } from '../../src/lib/rules';

describe('emails', () => {
  it('any valid email is allowed', () => {
    expect(isCompanyEmail('A@VillaCarteGroup.com')).toBe(true);
    expect(isCompanyEmail('Staff@LaGreenHotel.com')).toBe(true);
    expect(isCompanyEmail('someone@gmail.com')).toBe(true);
    expect(isCompanyEmail('not-an-email')).toBe(false);
    expect(isCompanyEmail('a@b')).toBe(false);
    expect(isCompanyEmail('')).toBe(false);
    expect(isCompanyEmail(null)).toBe(false);
  });
  it('admin, case-insensitive', () => {
    expect(isAdminEmail('Patomporn.K@villacartegroup.com')).toBe(true);
    expect(isAdminEmail('pp.dejpreecha@villacartegroup.com')).toBe(false);
  });
});

describe('stableShuffle', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `id${i}` }));
  it('same seed same order, keeps all items', () => {
    const a = stableShuffle(items, 'user-1');
    expect(stableShuffle(items, 'user-1')).toEqual(a);
    expect([...a].map((x) => x.id).sort()).toEqual(items.map((x) => x.id).sort());
  });
  it('different seed usually different order', () => {
    expect(stableShuffle(items, 'user-1')).not.toEqual(stableShuffle(items, 'user-2'));
  });
});

describe('voteButton', () => {
  const base = { signedIn: true, votingOpen: true, isMine: false, votedId: null, entryId: 'e1' };
  it.each([
    [{ ...base, signedIn: false }, 'Sign in to vote', false],
    [{ ...base, votingOpen: false }, 'Voting closed', false],
    [{ ...base, isMine: true }, 'Your entry', false],
    [{ ...base, votedId: 'e1' }, '✓ You voted', false],
    [{ ...base, votedId: 'e2' }, 'Already voted', false],
    [base, '✦ Cast your vote', true],
  ])('%o → %s', (input, label, enabled) => {
    expect(voteButton(input)).toEqual({ label, enabled });
  });
  it('shows "You voted" even after voting closes', () => {
    expect(voteButton({ ...base, votingOpen: false, votedId: 'e1' }).label).toBe('✓ You voted');
  });
});

describe('errorMessage', () => {
  it('maps known codes and falls back', () => {
    expect(errorMessage('VOTING_CLOSED')).toMatch(/closed/i);
    expect(errorMessage('something weird')).toMatch(/went wrong/i);
  });
});

