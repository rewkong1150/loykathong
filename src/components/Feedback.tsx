import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

// ---------------- confetti ----------------
type Part = { x: number; y: number; vx: number; vy: number; g: number; s: number; r: number; vr: number; c: string; life: number; star: boolean };
const COLS = ['#f7e3a1', '#d4af37', '#fff4cf', '#b8892b', '#ff9ec7', '#ffffff'];
const R = (a: number, b: number) => Math.random() * (b - a) + a;
let parts: Part[] = [];
let running = false;
let ctx: CanvasRenderingContext2D | null = null;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function loop() {
  if (!ctx) return;
  running = true;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life-- > 0);
  for (const p of parts) {
    p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.globalAlpha = Math.min(1, p.life / 40);
    ctx.fillStyle = p.c;
    if (p.star) {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = ((18 + k * 72) * Math.PI) / 180, b = ((54 + k * 72) * Math.PI) / 180;
        ctx.lineTo(Math.cos(a) * p.s, -Math.sin(a) * p.s);
        ctx.lineTo(Math.cos(b) * p.s * 0.45, -Math.sin(b) * p.s * 0.45);
      }
      ctx.fill();
    } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    ctx.restore();
  }
  if (parts.length) requestAnimationFrame(loop);
  else running = false;
}

/** Gold confetti burst at a screen point. */
export function burst(x: number, y: number, n = 140) {
  if (!ctx || reduced()) return;
  for (let i = 0; i < n; i++) {
    const a = R(0, Math.PI * 2), v = R(3, 11);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - R(2, 6), g: 0.22, s: R(4, 9), r: R(0, 6), vr: R(-0.3, 0.3), c: COLS[i % COLS.length], life: R(70, 120), star: Math.random() < 0.3 });
  }
  if (!running) loop();
}

/** Big celebration: several bursts across the screen. */
export function celebrate() {
  const pts = [[0.5, 0.35], [0.2, 0.5], [0.8, 0.5], [0.35, 0.25], [0.65, 0.25]];
  pts.forEach(([x, y], i) => setTimeout(() => burst(innerWidth * x, innerHeight * y, 160), i * 220));
}

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    ctx = cv.getContext('2d');
    const size = () => {
      cv.width = innerWidth * devicePixelRatio;
      cv.height = innerHeight * devicePixelRatio;
      ctx?.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    size();
    addEventListener('resize', size);
    return () => removeEventListener('resize', size);
  }, []);
  return <canvas id="confetti" ref={ref} />;
}

// ---------------- toast ----------------
type ToastFn = (msg: ReactNode, kind?: 'ok' | 'err') => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: ReactNode; kind: 'ok' | 'err'; show: boolean }>({ msg: '', kind: 'ok', show: false });
  const timer = useRef<number>(0);
  const toast = useCallback<ToastFn>((msg, kind = 'ok') => {
    setState({ msg, kind, show: true });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, show: false })), kind === 'err' ? 4200 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={`toast${state.show ? ' show' : ''}${state.kind === 'err' ? ' err' : ''}`} role="status" aria-live="polite">
        {state.kind === 'ok' && <svg width="26" viewBox="0 0 64 44"><use href="#crown" /></svg>}
        <span>{state.msg}</span>
      </div>
    </ToastCtx.Provider>
  );
}
