import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { stableShuffle, voteButton } from '../lib/rules';
import type { Contest, Entry } from '../lib/types';
import { EntryFrame } from './Chrome';

type V = CSSProperties & Record<`--${string}`, string | number>;

export interface BoardProps {
  contest: Contest;
  entries: Entry[];
  votedId: string | null;
  votingOpen: boolean;
  seed: string;
  onVote: (e: Entry, at: DOMRect) => void;
  onOpen: (e: Entry) => void;
}

export function VoteBtn({ entry, votedId, votingOpen, onVote, small }: {
  entry: Entry; votedId: string | null; votingOpen: boolean; onVote: BoardProps['onVote']; small?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const b = voteButton({ signedIn: true, votingOpen, isMine: entry.isMine, votedId, entryId: entry.id });
  return (
    <button
      className={`btn${small ? ' sm' : ''}${busy ? ' busy' : ''}`}
      disabled={!b.enabled}
      onClick={async (ev) => {
        ev.stopPropagation();
        setBusy(true);
        try { await onVote(entry, ev.currentTarget.getBoundingClientRect()); } finally { setBusy(false); }
      }}
    >
      {busy ? 'Voting…' : b.label}
    </button>
  );
}

// ---------------- before results ----------------
export function Gallery({ contest, entries, votedId, votingOpen, seed, onVote, onOpen }: BoardProps) {
  const list = stableShuffle(entries, seed);
  if (!list.length) return <Empty contest={contest} />;
  return (
    <>
      <div className="soon">
        <b>Results coming soon</b>
        <span>Scores stay secret until the winners are announced. {votingOpen ? 'Pick your favourite. You get one vote.' : ''}</span>
      </div>
      <div className="gallery">
        {list.map((e, i) => (
          <div className="gc" key={e.id} style={{ '--dl': `${Math.min(i, 12) * 0.07}s` } as V}>
            <EntryFrame src={e.imageUrl} alt={e.name} tag={e.isMine ? (contest === 'costume' ? 'You' : 'Your team') : undefined} onClick={() => onOpen(e)} />
            <h4>{e.name}</h4>
            <small>{e.subtitle}</small>
            <VoteBtn entry={e} votedId={votedId} votingOpen={votingOpen} onVote={onVote} />
          </div>
        ))}
      </div>
    </>
  );
}

function Empty({ contest }: { contest: Contest }) {
  return (
    <div className="empty">
      <b>No entries yet</b>
      {contest === 'costume' ? 'Be the first to show off your costume.' : 'Be the first team to float a krathong.'}
    </div>
  );
}

// ---------------- animated number ----------------
export function Count({ value, delay = 0 }: { value: number; delay?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current, to = value;
    let raf = 0;
    const t = window.setTimeout(() => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 1200), k = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(start + (to - start) * k));
        if (p < 1) raf = requestAnimationFrame(step);
        else from.current = to;
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); from.current = to; };
  }, [value, delay]);
  return <b>{shown}</b>;
}

// ---------------- after results (and admin) ----------------
export interface PodiumProps extends BoardProps {
  /** Changes to a new number to replay the reveal sequence. 0 = normal entrance. */
  revealKey: number;
  admin?: { adjust: (e: Entry, d: number) => void; remove: (e: Entry) => void };
  plusFor: string | null;
}

const ROMAN = ['I', 'II', 'III'];

export function Podium({ contest, entries, votedId, votingOpen, onVote, onOpen, revealKey, admin, plusFor }: PodiumProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rects = useRef(new Map<string, DOMRect>());

  // FLIP: animate cards from their previous position when the ranking changes.
  useLayoutEffect(() => {
    const els = ref.current?.querySelectorAll<HTMLElement>('[data-id]') ?? [];
    els.forEach((el) => {
      const id = el.dataset.id!, now = el.getBoundingClientRect(), was = rects.current.get(id);
      if (was && (Math.abs(was.left - now.left) > 2 || Math.abs(was.top - now.top) > 2)) {
        el.animate([{ transform: `translate(${was.left - now.left}px,${was.top - now.top}px)` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      rects.current.set(id, now);
    });
  });

  if (!entries.length) return <Empty contest={contest} />;
  const sorted = [...entries].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const top: (Entry | undefined)[] = [sorted[1], sorted[0], sorted[2]];
  const reveal = revealKey > 0;
  const tools = (e: Entry) => admin && (
    <div className="tools" onClick={(ev) => ev.stopPropagation()}>
      <button onClick={() => admin.adjust(e, -5)}>−5</button>
      <button onClick={() => admin.adjust(e, 5)}>+5</button>
      <button className="del" onClick={() => admin.remove(e)}>Delete</button>
    </div>
  );

  return (
    <div ref={ref} key={revealKey}>
      <div className={`podium${reveal ? ' reveal' : ''}`}>
        {top.map((e, i) => {
          const place = i === 1 ? 0 : i === 0 ? 1 : 2;
          if (!e) return <div className="pc ghost" key={`g${i}`} />;
          const rv = [0.9, 1.8, 0][i]; // reveal order: III, II, I
          return (
            <div className={`pc${place === 0 ? ' win' : ''}`} key={e.id} data-id={e.id}
              style={{ '--dl': `${[0.25, 0, 0.45][i]}s`, '--rv': `${rv}s` } as V}>
              <EntryFrame src={e.imageUrl} alt={e.name} crown={place === 0} onClick={() => onOpen(e)} />
              <div className="num">{e.rank && e.rank > 3 ? e.rank : ROMAN[(e.rank ?? place + 1) - 1] ?? ROMAN[place]}</div>
              <h4>{e.name}</h4>
              <small>{e.subtitle}</small>
              <div className="pts">
                <Count value={e.score ?? 0} delay={reveal ? rv * 1000 + 500 : 0} /> points
                {plusFor === e.id && <span className="plus">+10</span>}
              </div>
              <VoteBtn entry={e} votedId={votedId} votingOpen={votingOpen} onVote={onVote} />
              {tools(e)}
            </div>
          );
        })}
      </div>
      {sorted.length > 3 && (
        <div className="rest">
          {sorted.slice(3).map((e, i) => (
            <div className="rc" key={e.id} data-id={e.id} style={{ '--dl': `${(reveal ? 2.8 : 0.6) + Math.min(i, 10) * 0.08}s` } as V} onClick={() => onOpen(e)}>
              <div className="r">{e.rank}</div>
              <img className="thumb" src={e.imageUrl} alt="" loading="lazy" />
              <div className="who">
                <h5>{e.name}</h5>
                <small>{e.subtitle}</small>
                {tools(e)}
              </div>
              <div className="p">
                <Count value={e.score ?? 0} delay={reveal ? 3000 : 0} />pts
                <div style={{ marginTop: 6 }}><VoteBtn entry={e} votedId={votedId} votingOpen={votingOpen} onVote={onVote} small /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- detail modal body ----------------
export function EntryDetail({ entry, contest, votedId, votingOpen, onVote }: {
  entry: Entry; contest: Contest; votedId: string | null; votingOpen: boolean; onVote: BoardProps['onVote'];
}) {
  return (
    <div className="detail">
      <p className="note" style={{ marginBottom: 14 }}>{entry.subtitle}{entry.score != null && ` · ${entry.score} points · rank ${entry.rank}`}</p>
      {contest === 'krathong' && entry.teamImageUrl ? (
        <div className="pair">
          <img src={entry.imageUrl} alt="Krathong" />
          <img src={entry.teamImageUrl} alt="Team" />
        </div>
      ) : (
        <img src={entry.imageUrl} alt={entry.name} />
      )}
      {entry.members.length > 0 && (
        <div className="members">{entry.members.map((m, i) => <span key={i}>{m.name}</span>)}</div>
      )}
      <div className="actions">
        <VoteBtn entry={entry} votedId={votedId} votingOpen={votingOpen} onVote={onVote} />
      </div>
    </div>
  );
}
