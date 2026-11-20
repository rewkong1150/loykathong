import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from './api';
import type { AppUser, Contest, Entry, MyVotes, Settings } from './types';

/**
 * Settings + both leaderboards + my votes, kept fresh by realtime on the settings row
 * (its data_version bumps on every entry/vote change), tab focus, and a slow safety poll.
 */
export function useLive(backend: Backend, user: AppUser | null) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [boards, setBoards] = useState<Record<Contest, Entry[]>>({ costume: [], krathong: [] });
  const [myVotes, setMyVotes] = useState<MyVotes>({ costume: null, krathong: null });
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const n = ++seq.current;
    try {
      const [s, c, k, v] = await Promise.all([
        backend.getSettings(), backend.getLeaderboard('costume'), backend.getLeaderboard('krathong'), backend.getMyVotes(),
      ]);
      if (n !== seq.current) return; // a newer refresh already landed
      setSettings(s);
      setBoards({ costume: c, krathong: k });
      setMyVotes(v);
      setError(null);
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    }
  }, [backend, user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    let t = 0;
    const later = () => { clearTimeout(t); t = window.setTimeout(refresh, 250); };
    const unsub = backend.subscribe((s) => { setSettings(s); later(); });
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    const poll = window.setInterval(refresh, 30000);
    return () => {
      unsub();
      clearTimeout(t);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [backend, user, refresh]);

  return { settings, boards, myVotes, setMyVotes, refresh, error };
}
