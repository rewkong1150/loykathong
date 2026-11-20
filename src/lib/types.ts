export type Contest = 'costume' | 'krathong';
export const CONTESTS: Contest[] = ['costume', 'krathong'];

export interface Settings {
  costume_registration_open: boolean;
  costume_voting_open: boolean;
  krathong_registration_open: boolean;
  krathong_voting_open: boolean;
  costume_results_published: boolean;
  krathong_results_published: boolean;
  data_version: number;
}

export type FlagKey = Exclude<keyof Settings, 'data_version'>;

export interface Member {
  name: string;
  /** Only present for members of the team and the admin. */
  email?: string;
}

export interface Entry {
  id: string;
  name: string;
  subtitle: string;
  imagePath: string;
  imageUrl: string;
  teamImagePath: string | null;
  teamImageUrl: string | null;
  members: Member[];
  isMine: boolean;
  /** null until results are announced (always set for the admin). */
  score: number | null;
  rank: number | null;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export type MyVotes = Record<Contest, string | null>;

export const flagKey = (c: Contest, what: 'registration_open' | 'voting_open' | 'results_published') =>
  `${c}_${what}` as FlagKey;
