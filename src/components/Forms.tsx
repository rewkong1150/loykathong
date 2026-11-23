import { useEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/api';
import { compressImage } from '../lib/image';
import { errorMessage, isCompanyEmail } from '../lib/rules';
import type { AppUser, Entry, Member } from '../lib/types';
import { burst, useToast } from './Feedback';
import Modal, { Confirm } from './Modal';

// accept="image/*" (no explicit .heic) makes iPhone Safari hand us a JPEG instead of raw HEIC.
const PHOTO_READ_ERROR = "We couldn't open that file as a photo. Please choose a different photo, or take a screenshot of it and upload that.";

// Compresses the photo as soon as it's picked, so problems show up right away
// and the preview is exactly what will be uploaded.
function PhotoPick({ label, preview, onPick }: { label: string; preview: string | null; onPick: (b: Blob) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="drop">
        {working ? <div className="hint"><b>Preparing photo…</b></div> : preview ? <img src={preview} alt="" /> : (
          <div className="hint"><b>Add a photo</b>Tap to choose · large photos are resized for you</div>
        )}
        <input ref={input} type="file" accept="image/*" onChange={async (e) => {
          const el = e.currentTarget;
          const f = el.files?.[0];
          if (!f) return;
          setWorking(true);
          try {
            onPick(await compressImage(f));
          } catch {
            // File details help us diagnose reports from users' phones.
            toast(`${PHOTO_READ_ERROR} (${f.type || 'unknown type'}, ${(f.size / 1e6).toFixed(1)} MB)`, 'err');
          } finally {
            setWorking(false);
            el.value = ''; // allow picking the same photo again
          }
        }} />
      </div>
    </label>
  );
}

function useSubmit(onDone: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>, el?: HTMLElement | null) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (el) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); }
      toast(msg);
      onDone();
    } catch (e) {
      const code = (e as Error).message;
      toast(code === 'BAD_IMAGE_FILE' ? PHOTO_READ_ERROR : errorMessage(code), 'err');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// ---------------- costume ----------------
export function CostumeForm({ open, onClose, user, existing, backend, onSaved }: {
  open: boolean; onClose: () => void; user: AppUser; existing: Entry | null; backend: Backend; onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const done = () => { onSaved(); onClose(); };
  const { busy, run } = useSubmit(done);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? user.name);
    setTitle(existing?.subtitle ?? '');
    setFile(null);
    setPreview(existing?.imageUrl ?? null);
  }, [open, existing, user.name]);

  const save = () => run(async () => {
    if (!name.trim()) throw new Error('NAME_REQUIRED');
    if (!file && !existing) throw new Error('IMAGE_REQUIRED');
    const path = file ? await backend.uploadImage(file, user.id, 'costume') : existing!.imagePath;
    await backend.saveCostumeEntry(title.trim(), path, name.trim());
    return existing ? 'Your costume entry is updated ✦' : "You're in the costume contest ✦";
  }, submitRef.current);

  return (
    <Modal open={open} title={existing ? 'Edit your costume' : 'Enter the costume contest'} onClose={onClose}>
      <p className="note">One entry per person. You can change it until registration closes.</p>
      <PhotoPick label="Costume photo" preview={preview} onPick={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} />
      <div className="row2">
        <label className="field"><span>Your name</span>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field"><span>Costume title (optional)</span>
          <input className="input" value={title} maxLength={80} placeholder="e.g. Lanna Princess" onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>
      <div className="actions">
        {existing && <button className="btn danger" disabled={busy} onClick={() => setConfirmDel(true)}>Withdraw</button>}
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button ref={submitRef} className={`btn${busy ? ' busy' : ''}`} onClick={save}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Submit entry'}</button>
      </div>
      <Confirm open={confirmDel} title="Withdraw your entry?" body="Your costume entry and any votes it received will be removed."
        confirmLabel="Withdraw" onClose={() => setConfirmDel(false)}
        onConfirm={() => run(async () => { await backend.deleteMyCostumeEntry(); return 'Your entry was withdrawn'; })} />
    </Modal>
  );
}

// ---------------- krathong team ----------------
export function KrathongForm({ open, onClose, user, existing, backend, onSaved }: {
  open: boolean; onClose: () => void; user: AppUser; existing: Entry | null; backend: Backend; onSaved: () => void;
}) {
  const toast = useToast();
  const me: Member = { name: user.name, email: user.email.toLowerCase() };
  const [name, setName] = useState('');
  const [members, setMembers] = useState<Member[]>([me]);
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [kFile, setKFile] = useState<Blob | null>(null);
  const [tFile, setTFile] = useState<Blob | null>(null);
  const [kPrev, setKPrev] = useState<string | null>(null);
  const [tPrev, setTPrev] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const { busy, run } = useSubmit(() => { onSaved(); onClose(); });

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    const others = (existing?.members ?? []).filter((m) => m.email && m.email !== me.email) as Member[];
    setMembers([me, ...others]);
    setKFile(null); setTFile(null);
    setKPrev(existing?.imageUrl ?? null);
    setTPrev(existing?.teamImageUrl ?? null);
    setMName(''); setMEmail('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  const add = () => {
    const email = mEmail.trim().toLowerCase();
    if (!mName.trim() || !email) return toast('Enter a name and an email', 'err');
    if (!isCompanyEmail(email)) return toast('Please enter a valid email address', 'err');
    if (members.some((m) => m.email === email)) return toast('That person is already in the list', 'err');
    setMembers([...members, { name: mName.trim(), email }]);
    setMName(''); setMEmail('');
  };

  const save = () => run(async () => {
    if (!name.trim()) throw new Error('NAME_REQUIRED');
    if ((!kFile && !existing) || (!tFile && !existing)) throw new Error('IMAGE_REQUIRED');
    const k = kFile ? await backend.uploadImage(kFile, user.id, 'krathong') : existing!.imagePath;
    const t = tFile ? await backend.uploadImage(tFile, user.id, 'team') : existing!.teamImagePath!;
    await backend.saveKrathongTeam(existing?.id ?? null, name.trim(), members, k, t);
    return existing ? 'Your team is updated ✦' : `Team "${name.trim()}" is registered ✦`;
  }, submitRef.current);

  return (
    <Modal open={open} title={existing ? 'Edit your team' : 'Register a krathong team'} onClose={onClose}>
      <p className="note">Each person can be in one team. Only you (the creator) can edit the team, until registration closes.</p>
      <label className="field"><span>Team name</span>
        <input className="input" value={name} maxLength={80} placeholder="e.g. Team Finance" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="row2">
        <PhotoPick label="Krathong photo" preview={kPrev} onPick={(f) => { setKFile(f); setKPrev(URL.createObjectURL(f)); }} />
        <PhotoPick label="Team photo" preview={tPrev} onPick={(f) => { setTFile(f); setTPrev(URL.createObjectURL(f)); }} />
      </div>
      <div className="field"><span>Members ({members.length})</span>
        {members.map((m, i) => (
          <div className="memb" key={m.email}>
            {m.name}<small>{m.email}{i === 0 && ' · you'}</small>
            {i > 0 && <button aria-label={`Remove ${m.name}`} onClick={() => setMembers(members.filter((x) => x.email !== m.email))}>×</button>}
          </div>
        ))}
        <div className="row2" style={{ marginTop: 10 }}>
          <input className="input" value={mName} placeholder="Member name" onChange={(e) => setMName(e.target.value)} />
          <input className="input" value={mEmail} placeholder="name@example.com" onChange={(e) => setMEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <div style={{ marginTop: 10 }}><button className="btn ghost sm" onClick={add}>+ Add member</button></div>
      </div>
      <div className="actions">
        {existing && <button className="btn danger" disabled={busy} onClick={() => setConfirmDel(true)}>Delete team</button>}
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button ref={submitRef} className={`btn${busy ? ' busy' : ''}`} onClick={save}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Register team'}</button>
      </div>
      <Confirm open={confirmDel} title="Delete your team?" body="The team, its members and any votes it received will be removed."
        confirmLabel="Delete team" onClose={() => setConfirmDel(false)}
        onConfirm={() => run(async () => { await backend.deleteMyKrathongTeam(existing!.id); return 'Your team was deleted'; })} />
    </Modal>
  );
}
