import { useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import type { AppUser, Contest, Settings } from '../lib/types';

// ---------------- Nav ----------------
export function Nav({ user, isAdmin, onSignOut }: { user: AppUser | null; isAdmin: boolean; onSignOut: () => void }) {
  return (
    <nav className="top">
      <div className="logo"><svg viewBox="0 0 120 92"><use href="#kr" /></svg>Villa Carte · Loy Krathong</div>
      {user && (
        <div className="me">
          <span className="name">{user.name}</span>
          {isAdmin && <span className="badge">Admin</span>}
          {user.avatarUrl ? <img className="av" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <div className="av" />}
          <button className="linkbtn" onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </nav>
  );
}

// ---------------- Headline ----------------
export function Headline() {
  const words: ReactNode[] = ['A', 'night', 'of', <i key="l">light</i>, <i key="a">&amp;</i>, <i key="g">grace</i>];
  return (
    <h1 className="title">
      {words.map((w, i) => (
        <span key={i}>
          <span className="w" style={{ '--i': i } as React.CSSProperties}>{w}</span>
          {i === 2 ? <br /> : ' '}
        </span>
      ))}
    </h1>
  );
}

// ---------------- Programme ----------------
export function phase(s: Settings, c: Contest): { label: string; cls: 'on' | 'off' | 'done' } {
  if (s[`${c}_results_published`]) return { label: 'Results announced', cls: 'done' };
  if (s[`${c}_voting_open`]) return { label: 'Voting open', cls: 'on' };
  if (s[`${c}_registration_open`]) return { label: 'Registration open', cls: 'on' };
  return { label: 'Closed', cls: 'off' };
}

export function Programme({ settings }: { settings: Settings }) {
  const rows: [Contest, string, string][] = [['costume', 'Morning', 'Costume Contest'], ['krathong', 'Afternoon', 'Krathong Contest']];
  return (
    <div className="sched"><div>
      <h5>Programme <span>Live</span></h5>
      {rows.map(([c, when, name]) => {
        const p = phase(settings, c);
        return (
          <div className="slot" key={c}>
            <div><small>{when}</small><b>{name}</b></div>
            <span className={`st ${p.cls}`}>{p.label}</span>
          </div>
        );
      })}
    </div></div>
  );
}

// ---------------- Tabs ----------------
export function ContestTabs({ value, onChange }: { value: Contest; onChange: (c: Contest) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const move = () => {
      const a = wrap.current?.querySelector<HTMLElement>('.tab.act');
      if (!a || !wrap.current) return;
      const p = wrap.current.getBoundingClientRect(), r = a.getBoundingClientRect();
      setInk({ left: r.left - p.left, width: r.width });
    };
    move();
    const t = setTimeout(move, 600); // after fonts load
    addEventListener('resize', move);
    return () => { clearTimeout(t); removeEventListener('resize', move); };
  }, [value]);
  const tabs: [Contest, string, string][] = [['costume', 'Costume', 'Morning'], ['krathong', 'Krathong', 'Afternoon']];
  return (
    <div className="tabs" ref={wrap} role="tablist">
      {tabs.map(([c, label, when]) => (
        <button key={c} role="tab" aria-selected={value === c} className={`tab${value === c ? ' act' : ''}`} onClick={() => onChange(c)}>
          <small>{when}</small>{label}
        </button>
      ))}
      <span className="ink" style={ink} />
    </div>
  );
}

// ---------------- Frame with tilt & glare ----------------
export function EntryFrame({ src, alt, crown, tag, onClick }: { src: string; alt: string; crown?: boolean; tag?: string; onClick?: () => void }) {
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(800px) rotateY(${(x - 0.5) * 14}deg) rotateX(${(0.5 - y) * 14}deg) translateY(-6px)`;
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  return (
    <div className="frame" onMouseMove={move} onMouseLeave={(e) => (e.currentTarget.style.transform = '')} onClick={onClick}>
      {crown && <svg className="crown" viewBox="0 0 64 44"><use href="#crown" /></svg>}
      <div className="photo">
        {tag && <span className="tag">{tag}</span>}
        <img src={src} alt={alt} loading="lazy" />
      </div>
      <div className="glare" />
    </div>
  );
}

export function Divider() {
  return <div className="divider"><svg viewBox="0 0 40 40"><use href="#lotus" /></svg></div>;
}
