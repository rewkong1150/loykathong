import { useEffect, useState } from 'react';
import type { Backend, Stats } from '../lib/api';
import { errorMessage } from '../lib/rules';
import { flagKey, type Contest, type FlagKey, type Settings } from '../lib/types';
import { useToast } from './Feedback';
import { Confirm } from './Modal';

type Ask = { flag: FlagKey; value: boolean; title: string; body: string; label: string } | null;

const NAMES: Record<Contest, string> = { costume: 'Costume', krathong: 'Krathong' };

export default function AdminPanel({ settings, backend, onPreviewReveal }: {
  settings: Settings; backend: Backend; onPreviewReveal: (c: Contest) => void;
}) {
  const toast = useToast();
  const [ask, setAsk] = useState<Ask>(null);
  const [stats, setStats] = useState<Stats>([]);

  useEffect(() => {
    backend.adminStats().then(setStats).catch(() => {});
  }, [backend, settings.data_version]);

  const apply = async (flag: FlagKey, value: boolean) => {
    try {
      await backend.adminSetFlag(flag, value);
      toast('Saved. Everyone sees the change now.');
    } catch (e) {
      toast(errorMessage((e as Error).message), 'err');
    }
  };

  const toggle = (c: Contest, what: 'registration_open' | 'voting_open') => {
    const flag = flagKey(c, what), value = !settings[flag];
    const thing = what === 'registration_open' ? 'registration' : 'voting';
    setAsk({
      flag, value,
      title: `${value ? 'Open' : 'Close'} ${NAMES[c].toLowerCase()} ${thing}?`,
      body: value
        ? `Everyone can ${thing === 'registration' ? 'register or edit entries' : 'vote'} in the ${NAMES[c].toLowerCase()} contest as soon as you confirm.`
        : `Nobody can ${thing === 'registration' ? 'register or edit entries' : 'vote'} in the ${NAMES[c].toLowerCase()} contest after you confirm.`,
      label: value ? 'Open now' : 'Close now',
    });
  };

  const announce = (c: Contest) => {
    const flag = flagKey(c, 'results_published'), value = !settings[flag];
    setAsk({
      flag, value,
      title: value ? `Announce ${NAMES[c].toLowerCase()} results?` : `Hide ${NAMES[c].toLowerCase()} results again?`,
      body: value
        ? 'Everyone online will see the winners revealed right away, with scores and the full ranking.'
        : 'Scores and ranking will be hidden from everyone except you.',
      label: value ? '✦ Announce' : 'Hide results',
    });
  };

  return (
    <details className="admin" open>
      <summary>Admin controls <small>Only you can see this</small></summary>
      <div className="body">
        {(['costume', 'krathong'] as Contest[]).map((c) => {
          const s = stats.find((x) => x.contest === c);
          const published = settings[flagKey(c, 'results_published')];
          return (
            <div className="col" key={c}>
              <h6>{NAMES[c]} <small>{s ? `${s.entries} entries · ${s.votes} votes` : '…'}</small></h6>
              {(['registration_open', 'voting_open'] as const).map((w) => {
                const on = settings[flagKey(c, w)];
                return (
                  <div className="sw" key={w}>
                    {w === 'registration_open' ? 'Registration' : 'Voting'} · <b style={{ color: on ? 'var(--gold-l)' : 'inherit' }}>{on ? 'Open' : 'Closed'}</b>
                    <button className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={`${NAMES[c]} ${w}`} onClick={() => toggle(c, w)} />
                  </div>
                );
              })}
              <button className={`btn announce${published ? ' ghost' : ''}`} onClick={() => announce(c)}>
                {published ? 'Hide results' : '✦ Announce results'}
              </button>
              <button className="linkbtn" style={{ marginTop: 10 }} onClick={() => onPreviewReveal(c)}>Preview the reveal (only on your screen)</button>
            </div>
          );
        })}
      </div>
      <Confirm open={!!ask} title={ask?.title ?? ''} body={ask?.body ?? ''} confirmLabel={ask?.label ?? 'OK'}
        onClose={() => setAsk(null)} onConfirm={() => ask && apply(ask.flag, ask.value)} />
    </details>
  );
}
