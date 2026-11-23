import { supabase } from './supabase';
import { compressImage } from './image';
import type { Contest, Entry, FlagKey, Member, MyVotes, Settings } from './types';

/** RPC errors come back as Postgres messages like "VOTING_CLOSED"; surface just the code. */
function fail(error: { message?: string } | null): never {
  const msg = error?.message ?? 'UNKNOWN';
  const code = msg.match(/\b[A-Z][A-Z_]{3,}\b/)?.[0] ?? msg;
  throw new Error(code);
}

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(error);
  return data as T;
}

export const publicUrl = (path: string | null) =>
  path ? supabase.storage.from('entries').getPublicUrl(path).data.publicUrl : null;

// ---------- auth ----------
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { hd: '*', prompt: 'select_account' },
    },
  });
  if (error) fail(error);
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ---------- reads ----------
export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error) fail(error);
  return { ...(data as Settings), data_version: Number((data as Settings).data_version) };
}

interface LeaderRow {
  id: string;
  name: string;
  subtitle: string;
  image_path: string;
  team_image_path: string | null;
  members: Member[];
  is_mine: boolean;
  score: number | null;
  rank: number | null;
}

export async function getLeaderboard(contest: Contest): Promise<Entry[]> {
  const rows = await rpc<LeaderRow[]>('get_leaderboard', { p_contest: contest });
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    imagePath: r.image_path,
    imageUrl: publicUrl(r.image_path)!,
    teamImagePath: r.team_image_path,
    teamImageUrl: publicUrl(r.team_image_path),
    members: r.members ?? [],
    isMine: r.is_mine,
    score: r.score,
    rank: r.rank,
  }));
}

export async function getMyVotes(): Promise<MyVotes> {
  const rows = await rpc<{ contest: Contest; entry_id: string }[]>('get_my_votes');
  const out: MyVotes = { costume: null, krathong: null };
  for (const r of rows ?? []) out[r.contest] = r.entry_id;
  return out;
}

// ---------- user actions ----------
export const castVote = (contest: Contest, entryId: string) =>
  rpc('cast_vote', { p_contest: contest, p_entry_id: entryId });

export const saveCostumeEntry = (title: string, imagePath: string, displayName: string) =>
  rpc<string>('save_costume_entry', { p_title: title, p_image_path: imagePath, p_display_name: displayName });

export const deleteMyCostumeEntry = () => rpc('delete_my_costume_entry');

export const saveKrathongTeam = (
  teamId: string | null,
  name: string,
  members: Member[],
  krathongImagePath: string,
  teamImagePath: string,
) =>
  rpc<string>('save_krathong_team', {
    p_team_id: teamId,
    p_name: name,
    p_members: members,
    p_krathong_image_path: krathongImagePath,
    p_team_image_path: teamImagePath,
  });

export const deleteMyKrathongTeam = (teamId: string) => rpc('delete_my_krathong_team', { p_team_id: teamId });

export async function uploadImage(file: File, userId: string, slot: string): Promise<string> {
  const blob = await compressImage(file);
  const path = `${userId}/${slot}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('entries').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) fail(error);
  return path;
}

// ---------- admin ----------
export const adminSetFlag = (flag: FlagKey, value: boolean) => rpc('admin_set_flag', { p_flag: flag, p_value: value });

export const adminAdjustScore = (contest: Contest, entryId: string, delta: number) =>
  rpc('admin_adjust_score', { p_contest: contest, p_entry_id: entryId, p_delta: delta });

export const adminDeleteEntry = (contest: Contest, entryId: string) =>
  rpc('admin_delete_entry', { p_contest: contest, p_entry_id: entryId });

export const adminStats = () => rpc<{ contest: Contest; entries: number; votes: number }[]>('admin_stats');

// ---------- realtime ----------
/** Calls onChange whenever the settings row changes (flags or data_version). */
export function subscribe(onChange: (s: Settings) => void): () => void {
  const ch = supabase
    .channel('settings-live')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
      const s = payload.new as Settings;
      onChange({ ...s, data_version: Number(s.data_version) });
    })
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

export type Stats = { contest: Contest; entries: number; votes: number }[];

/** Everything the UI needs from the server. The dev-only demo implements the same shape. */
export interface Backend {
  getSettings(): Promise<Settings>;
  getLeaderboard(c: Contest): Promise<Entry[]>;
  getMyVotes(): Promise<MyVotes>;
  castVote(c: Contest, id: string): Promise<unknown>;
  saveCostumeEntry(title: string, imagePath: string, displayName: string): Promise<string>;
  deleteMyCostumeEntry(): Promise<unknown>;
  saveKrathongTeam(teamId: string | null, name: string, members: Member[], kPath: string, tPath: string): Promise<string>;
  deleteMyKrathongTeam(teamId: string): Promise<unknown>;
  uploadImage(file: File, userId: string, slot: string): Promise<string>;
  adminSetFlag(flag: FlagKey, value: boolean): Promise<unknown>;
  adminAdjustScore(c: Contest, id: string, delta: number): Promise<unknown>;
  adminDeleteEntry(c: Contest, id: string): Promise<unknown>;
  adminStats(): Promise<Stats>;
  subscribe(onChange: (s: Settings) => void): () => void;
}

export const realBackend: Backend = {
  getSettings, getLeaderboard, getMyVotes, castVote, saveCostumeEntry, deleteMyCostumeEntry,
  saveKrathongTeam, deleteMyKrathongTeam, uploadImage, adminSetFlag, adminAdjustScore,
  adminDeleteEntry, adminStats, subscribe,
};
