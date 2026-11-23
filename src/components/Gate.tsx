import { Headline } from './Chrome';

export default function Gate({ mode, onSignIn }: { mode: 'loading' | 'signin' | 'blocked' | 'config'; onSignIn: () => void }) {
  return (
    <div className="gate">
      <div className="card">
        <div className="eyebrow" style={{ justifyContent: 'center' }}>Villa Carte · Loy Krathong 2026</div>
        <Headline />
        {mode === 'loading' && <p className="sub">Lighting the lanterns…</p>}
        {mode === 'signin' && (
          <>
            <p className="sub">Costume contest in the morning, krathong contest in the afternoon. Sign in with your Google account to join and vote.</p>
            <div className="cta"><button className="btn" onClick={onSignIn}>✦ Sign in with Google</button></div>
          </>
        )}
        {mode === 'blocked' && (
          <>
            <p className="sub">That account couldn't be used. Please sign in with a Google account that has an email address.</p>
            <div className="cta"><button className="btn" onClick={onSignIn}>Use another account</button></div>
          </>
        )}
        {mode === 'config' && (
          <p className="sub">This site isn't connected to its database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (see README).</p>
        )}
      </div>
    </div>
  );
}
