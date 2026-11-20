export const COMPANY_DOMAIN = 'villacartegroup.com';
export const ADMIN_EMAIL = 'patomporn.k@villacartegroup.com';
export const VOTE_POINTS = 10;

const COMPANY_RE = /^[^@\s]+@villacartegroup\.com$/i;

export function isCompanyEmail(e?: string | null): boolean {
  return !!e && COMPANY_RE.test(e.trim());
}

export function isAdminEmail(e?: string | null): boolean {
  return !!e && e.trim().toLowerCase() === ADMIN_EMAIL;
}

/** Deterministic shuffle so each viewer sees a fixed (but unbiased) order before results. */
export function stableShuffle<T extends { id: string }>(items: T[], seed: string): T[] {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  return [...items]
    .map((it) => ({ it, k: hash(`${seed}:${it.id}`) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.it);
}

export function voteButton(p: {
  signedIn: boolean;
  votingOpen: boolean;
  isMine: boolean;
  votedId: string | null;
  entryId: string;
}): { label: string; enabled: boolean } {
  if (!p.signedIn) return { label: 'Sign in to vote', enabled: false };
  if (p.isMine) return { label: 'Your entry', enabled: false };
  if (p.votedId === p.entryId) return { label: '✓ You voted', enabled: false };
  if (!p.votingOpen) return { label: 'Voting closed', enabled: false };
  if (p.votedId) return { label: 'Already voted', enabled: false };
  return { label: '✦ Cast your vote', enabled: true };
}

const MESSAGES: Record<string, string> = {
  NOT_COMPANY: 'Only Villa Carte company accounts can use this site.',
  NOT_ADMIN: 'Only the administrator can do that.',
  VOTING_CLOSED: 'Voting is closed for this contest right now.',
  REGISTRATION_CLOSED: 'Registration is closed for this contest right now.',
  ALREADY_VOTED: 'You have already voted in this contest.',
  OWN_ENTRY: "You can't vote for your own entry or team.",
  NOT_FOUND: 'That entry no longer exists.',
  IMAGE_REQUIRED: 'Please add a photo.',
  BAD_IMAGE: 'That photo upload is not valid. Please upload it again.',
  NAME_REQUIRED: 'Please fill in every name.',
  NOT_COMPANY_MEMBER: 'Every team member needs a @villacartegroup.com email.',
  MEMBER_IN_OTHER_TEAM: 'One of those people is already in another team.',
  ALREADY_IN_TEAM: 'You are already in a krathong team.',
  CREATOR_REQUIRED: 'You must stay in your own team.',
  NOT_OWNER: 'Only the person who created the team can change it.',
};

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? 'Something went wrong. Please try again.';
}
