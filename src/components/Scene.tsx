import { memo, useMemo, type CSSProperties } from 'react';

const R = (a: number, b: number) => Math.random() * (b - a) + a;
type V = CSSProperties & Record<`--${string}`, string | number>;

const WAVE_A = 'M0 30 Q75 10 150 30 T300 30 T450 30 T600 30 T750 30 T900 30 T1050 30 T1200 30 V60 H0Z';
const WAVE_B_LINE = 'M0 30 Q50 18 100 30 T200 30 T300 30 T400 30 T500 30 T600 30 T700 30 T800 30 T900 30 T1000 30 T1100 30 T1200 30';

/** The always-moving night river: stars, moon, lanterns, gold dust, waves and floating krathongs. */
function Scene() {
  const small = typeof window !== 'undefined' && window.innerWidth < 640;
  const k = small ? 0.5 : 1;

  const { stars, lanterns, dust, reflect, krathongs } = useMemo(() => {
    const stars = Array.from({ length: Math.round(160 * k) }, () => {
      const z = R(1, 2.6);
      return { top: `${R(0, 62)}%`, left: `${R(0, 100)}%`, width: z, height: z, '--d': `${R(2, 6)}s`, '--dl': `${-R(0, 6)}s` } as V;
    });
    const lanterns = Array.from({ length: Math.round(18 * k) }, () => {
      const w = R(8, 24);
      return {
        left: `${R(2, 96)}%`, opacity: 0.5 + w / 48,
        '--w': `${w}px`, '--t': `${R(24, 48) * (26 / (w + 8))}s`, '--dl': `${-R(0, 40)}s`, '--s': `${R(3, 6)}s`,
      } as V;
    });
    const dust = Array.from({ length: Math.round(40 * k) }, () => ({
      top: `${R(10, 95)}%`, left: `${R(0, 100)}%`,
      '--x': `${R(-60, 60)}px`, '--y': `${R(-80, -10)}px`, '--t': `${R(6, 14)}s`, '--dl': `${-R(0, 14)}s`,
    }) as V);
    const reflect = Array.from({ length: 14 }, (_, i) => ({ '--t': `${R(1.2, 3)}s`, '--dl': `${-R(0, 3)}s`, maxWidth: `${100 - i * 4}%` }) as V);
    const lanes: [number, number, number][] = [[8, 46, 58], [20, 60, 46], [34, 76, 36], [48, 96, 30], [62, 120, 24], [74, 150, 20]];
    const krathongs = lanes.flatMap(([top, w, t], i) =>
      Array.from({ length: small ? 1 : 2 }, (_, j) => ({
        rev: (i + j) % 2 === 1,
        bobDelay: `${-R(0, 3)}s`,
        style: { top: `${top}%`, zIndex: i, '--w': `${small ? w * 0.7 : w}px`, '--t': `${t}s`, '--dl': `${-R(0, t)}s` } as V,
      })),
    );
    return { stars, lanterns, dust, reflect, krathongs };
  }, [k, small]);

  return (
    <div className="scene" aria-hidden="true">
      <div className="sky" />
      <div className="pattern" />
      <div>{stars.map((s, i) => <div key={i} className="star" style={s} />)}</div>
      <div className="shoot" style={{ top: '12%', left: '70%' }} />
      <div className="shoot s2" style={{ top: '22%', left: '45%' }} />
      <div className="halo" />
      <div className="moon" />
      <div>{lanterns.map((s, i) => <div key={i} className="lantern" style={s}><i /></div>)}</div>
      <div>{dust.map((s, i) => <div key={i} className="dust" style={s} />)}</div>
      <div className="river">
        <div className="wave" style={{ top: -30, opacity: 0.55, '--t': '22s' } as V}>
          <svg viewBox="0 0 1200 60" preserveAspectRatio="none"><path d={WAVE_A} fill="#120e1c" /></svg>
        </div>
        <div className="wave" style={{ top: -12, opacity: 0.8, '--t': '16s' } as V}>
          <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path d={`${WAVE_B_LINE} V60 H0Z`} fill="#0d0a14" />
            <path d={WAVE_B_LINE} fill="none" stroke="#d4af37" strokeOpacity=".25" />
          </svg>
        </div>
        <div className="reflect">{reflect.map((s, i) => <span key={i} style={s} />)}</div>
        {krathongs.map((kr, i) => (
          <div key={i} className={`kr${kr.rev ? ' rev' : ''}`} style={kr.style}>
            <div className="bob" style={{ animationDelay: kr.bobDelay }}>
              <div className="glowpool" />
              <svg viewBox="0 0 120 92"><use href="#kr" /></svg>
              <div className="flame" />
              <svg className="mirror" viewBox="0 0 120 92"><use href="#kr" /></svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(Scene);
