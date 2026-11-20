import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { realBackend, signInWithGoogle, signOut, type Backend } from './lib/api';
import { makeDemo } from './lib/demo';
import { errorMessage, isAdminEmail, isCompanyEmail } from './lib/rules';
import { isConfigured, supabase } from './lib/supabase';
import { flagKey, type AppUser, type Contest, type Entry, type Settings } from './lib/types';
import { useLive } from './lib/useLive';
import AdminPanel from './components/AdminPanel';
import { EntryDetail, Gallery, Podium } from './components/Boards';
import { ContestTabs, Divider, Headline, Nav, Programme } from './components/Chrome';
import { burst, celebrate, Confetti, ToastProvider, useToast } from './components/Feedback';
import { CostumeForm, KrathongForm } from './components/Forms';
import Gate from './components/Gate';
import Modal, { Confirm } from './components/Modal';
import Scene from './components/Scene';
import Symbols from './components/Symbols';

const demoParam = import.meta.env.DEV ? new URLSearchParams(location.search).get('demo') : null;

export default function App() {
  return (
    <ToastProvider>
      <Symbols />
      <Scene />
      <Confetti />
      {demoParam !== null ? <DemoRoot admin={demoParam === 'admin'} /> : <AuthRoot />}
    </ToastProvider>
  );
}

function DemoRoot({ admin }: { admin: boolean }) {
  const { backend, user } = useMemo(() => makeDemo(admin), [admin]);
  return <Main backend={backend} user={user} onSignOut={() => location.assign(location.pathname)} />;
}

function toUser(s: Session): AppUser {
  const m = s.user.user_metadata ?? {};
  const email = s.user.email ?? '';
  return { id: s.user.id, email, name: m.full_name || m.name || email.split('@')[0], avatarUrl: m.avatar_url || m.picture || null };
}

function AuthRoot() {
  const toast = useToast();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    // A rejected sign-up (non-company account) comes back with an error in the URL.
    const params = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
    if (params.get('error') || params.get('error_description')) {
      setBlocked(true);
      history.replaceState(null, '', location.pathname);
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !isCompanyEmail(session.user.email)) {
      setBlocked(true);
      signOut();
    }
  }, [session]);

  const user = useMemo(() => (session && isCompanyEmail(session.user.email) ? toUser(session) : null), [session]);
  const signIn = () => signInWithGoogle().catch((e) => toast(errorMessage(e.message), 'err'));

  if (!isConfigured) return <Gate mode="config" onSignIn={signIn} />;
  if (session === undefined) return <Gate mode="loading" onSignIn={signIn} />;
  if (!user) return <Gate mode={blocked ? 'blocked' : 'signin'} onSignIn={signIn} />;
  return <Main backend={realBackend} user={user} onSignOut={signOut} />;
}

function defaultTab(s: Settings): Contest {
  for (const c of ['costume', 'krathong'] as Contest[]) {
    if (s[flagKey(c, 'voting_open')] || s[flagKey(c, 'registration_open')]) return c;
  }
  return s.krathong_results_published ? 'krathong' : 'costume';
}

function Main({ backend, user, onSignOut }: { backend: Backend; user: AppUser; onSignOut: () => void }) {
  const toast = useToast();
  const isAdmin = isAdminEmail(user.email);
  const { settings, boards, myVotes, setMyVotes, refresh, error } = useLive(backend, user);
  const [tab, setTab] = useState<Contest | null>(null);
  const [open, setOpen] = useState<Entry | null>(null);
  const [form, setForm] = useState<Contest | null>(null);
  const [revealKey, setRevealKey] = useState<Record<Contest, number>>({ costume: 0, krathong: 0 });
  const [revealing, setRevealing] = useState<Contest | null>(null);
  const [plusFor, setPlusFor] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const prevPublished = useRef<Record<Contest, boolean> | null>(null);

  const current: Contest = tab ?? (settings ? defaultTab(settings) : 'costume');

  const playReveal = useCallback((c: Contest) => {
    setTab(c);
    setRevealing(c);
    setRevealKey((k) => ({ ...k, [c]: Date.now() }));
    setTimeout(() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    setTimeout(celebrate, 2400);
    setTimeout(() => setRevealing(null), 3600);
  }, []);

  // Play the reveal for everyone online the moment the admin announces results.
  useEffect(() => {
    if (!settings) return;
    const now = { costume: settings.costume_results_published, krathong: settings.krathong_results_published };
    const prev = prevPublished.current;
    prevPublished.current = now;
    if (!prev) return;
    (['costume', 'krathong'] as Contest[]).forEach((c) => { if (!prev[c] && now[c]) playReveal(c); });
  }, [settings, playReveal]);

  useEffect(() => { if (error) toast(errorMessage(error), 'err'); }, [error, toast]);

  if (!settings) {
    return (
      <div className="page">
        <Nav user={user} isAdmin={isAdmin} onSignOut={onSignOut} />
        <Gate mode="loading" onSignIn={() => {}} />
      </div>
    );
  }

  const entries = boards[current];
  const votingOpen = settings[flagKey(current, 'voting_open')];
  const showScores = settings[flagKey(current, 'results_published')] || isAdmin;
  const mine = (c: Contest) => boards[c].find((e) => e.isMine) ?? null;
  const myTeam = mine('krathong');
  const iCreatedTeam = !!myTeam && myTeam.members[0]?.email?.toLowerCase() === user.email.toLowerCase();

  const vote = async (e: Entry, at: DOMRect) => {
    try {
      await backend.castVote(current, e.id);
      burst(at.left + at.width / 2, at.top + at.height / 2);
      setMyVotes((v) => ({ ...v, [current]: e.id }));
      if (showScores) { setPlusFor(e.id); setTimeout(() => setPlusFor(null), 1300); }
      toast(<>Your vote for <b>{e.name}</b> is in ✦</>);
      refresh();
    } catch (err) {
      toast(errorMessage((err as Error).message), 'err');
      refresh();
    }
  };

  const regButtons = (['costume', 'krathong'] as Contest[])
    .filter((c) => settings[flagKey(c, 'registration_open')])
    .map((c) => {
      if (c === 'krathong' && myTeam && !iCreatedTeam) return null; // member of someone else's team
      const has = !!mine(c);
      const label = c === 'costume' ? (has ? 'Edit my costume' : 'Enter costume contest') : (has ? 'Edit my team' : 'Register krathong team');
      return <button key={c} className="btn ghost" onClick={() => setForm(c)}>{label}</button>;
    });

  const votedEntry = entries.find((e) => e.id === myVotes[current]);
  const myEntry = mine(current);

  return (
    <div className="page">
      <Nav user={user} isAdmin={isAdmin} onSignOut={onSignOut} />

      <section className="hero">
        <div>
          <div className="eyebrow">The 2026 Festival Awards</div>
          <Headline />
          <p className="sub">Two contests, one day. Dress to impress in the morning, then float the most beautiful krathong in the afternoon.</p>
          <div className="cta">
            <button className="btn" onClick={() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {settings.costume_voting_open || settings.krathong_voting_open ? '✦ Cast your vote' : '✦ See the entries'}
            </button>
            {regButtons}
          </div>
        </div>
        <Programme settings={settings} />
      </section>

      {isAdmin && <AdminPanel settings={settings} backend={backend} onPreviewReveal={playReveal} />}

      <div className="stage">
      <Divider />
      <div ref={boardRef} style={{ scrollMarginTop: 20 }}>
        <ContestTabs value={current} onChange={setTab} />
      </div>

      <div className="mystatus" key={current}>
        <span>
          {current === 'costume'
            ? myEntry ? <>Your entry: <b>{myEntry.subtitle || myEntry.name}</b></> : 'You have no costume entry'
            : myEntry ? <>Your team: <b>{myEntry.name}</b></> : 'You are not in a krathong team'}
        </span>
        <span>{votedEntry ? <>You voted for <b>{votedEntry.name}</b></> : votingOpen ? "You haven't voted yet" : 'Voting is closed'}</span>
      </div>

      {showScores ? (
        <Podium contest={current} entries={entries} votedId={myVotes[current]} votingOpen={votingOpen} seed={user.id}
          onVote={vote} onOpen={setOpen} revealKey={revealKey[current]} plusFor={plusFor}
          admin={isAdmin ? {
            adjust: (e, d) => backend.adminAdjustScore(current, e.id, d).then(refresh).catch((x) => toast(errorMessage(x.message), 'err')),
            remove: (e) => setToDelete(e),
          } : undefined} />
      ) : (
        <Gallery contest={current} entries={entries} votedId={myVotes[current]} votingOpen={votingOpen} seed={user.id}
          onVote={vote} onOpen={setOpen} />
      )}
      </div>

      {revealing && (
        <>
          <div className="reveal-veil" />
          <div className="reveal-title">The winners are…</div>
        </>
      )}

      <Modal open={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open && <EntryDetail entry={entries.find((e) => e.id === open.id) ?? open} contest={current} votedId={myVotes[current]} votingOpen={votingOpen}
          onVote={async (e, at) => { await vote(e, at); }} />}
      </Modal>
      <Confirm open={!!toDelete} title={`Delete "${toDelete?.name ?? ''}"?`} body="The entry and every vote it received will be removed. This can't be undone."
        confirmLabel="Delete" onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && backend.adminDeleteEntry(current, toDelete.id).then(() => { toast('Entry deleted'); refresh(); }).catch((x) => toast(errorMessage(x.message), 'err'))} />
      <CostumeForm open={form === 'costume'} onClose={() => setForm(null)} user={user} existing={mine('costume')} backend={backend} onSaved={refresh} />
      <KrathongForm open={form === 'krathong'} onClose={() => setForm(null)} user={user} existing={iCreatedTeam ? myTeam : null} backend={backend} onSaved={refresh} />
    </div>
  );
}
