import { useEffect, type ReactNode } from 'react';

export default function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <div className="inner">
          <h3>{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Small confirm dialog built on Modal. */
export function Confirm({ open, title, body, confirmLabel, onConfirm, onClose }: {
  open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="note" style={{ fontSize: 15, color: 'var(--muted)' }}>{body}</p>
      <div className="actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
