import { cloneElement, useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Check, LoaderCircle, Plus, X } from 'lucide-react';
import { clampedPercentage } from '../shared/calculations';
import { useWorkspace } from './api';

export function IconButton({ label, children, onClick, disabled = false, danger = false }: {
  label: string; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return <button type="button" className={`icon-button${danger ? ' danger' : ''}`}
    aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function Progress({ value, label, tone = 'green' }: { value: number; label: string; tone?: string }) {
  return <div className={`progress ${tone}`} role="progressbar" aria-label={label}
    aria-valuenow={Math.round(clampedPercentage(value))} aria-valuemin={0} aria-valuemax={100}
    aria-valuetext={`${Math.round(value)} percent`}>
    <span style={{ width: `${clampedPercentage(value)}%` }} />
  </div>;
}

export function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty"><span className="empty-mark"><Plus size={20} /></span>
    <h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Modal({ title, subtitle, children, onClose, wide = false }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const reference = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { pending, error } = useWorkspace();
  useEffect(() => {
    const dialog = reference.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={reference} aria-labelledby={id} className={`modal${wide ? ' wide' : ''}`}
    onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}
    onClick={event => {
      if (event.target !== reference.current || pending) return;
      const bounds = reference.current.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="modal-header"><div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <IconButton label="Close dialog" onClick={onClose} disabled={pending}><X size={20} /></IconButton></div>
    {error && <p className="modal-error" role="alert">{error}</p>}
    {children}
  </dialog>;
}

export function Field({ label, hint, children }: {
  label: string; hint?: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const description = [children.props['aria-describedby'], hint ? `${id}-hint` : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="field"><label htmlFor={id}>{label}</label>
    {cloneElement(children, { id, 'aria-describedby': description })}
    {hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}

export function Form({ children, onSubmit, onClose, submit = 'Save changes' }: {
  children: ReactNode; onSubmit: (data: FormData) => Promise<boolean>; onClose: () => void; submit?: string;
}) {
  const { pending } = useWorkspace();
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || submitted) return;
    const data = new FormData(event.currentTarget);
    setSubmitted(true);
    setFailed(false);
    const success = await onSubmit(data);
    setSubmitted(false);
    if (success) onClose();
    else setFailed(true);
  };
  return <form onSubmit={submitForm} className="form">
    <fieldset disabled={pending || submitted}>{children}</fieldset>
    {failed && <p className="form-error" role="alert">Could not complete this change. See the error message and try again.</p>}
    <div className="form-actions">
      <button type="button" className="button secondary" onClick={onClose} disabled={pending}>Cancel</button>
      <button className="button primary" disabled={pending || submitted}>
        {pending || submitted ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{submit}
      </button>
    </div>
  </form>;
}

export function Confirm({ title, description, onClose, onConfirm }: {
  title: string; description: string; onClose: () => void; onConfirm: () => Promise<boolean>;
}) {
  return <Modal title={title} onClose={onClose}><Form onClose={onClose} onSubmit={onConfirm} submit="Delete permanently">
    <p className="confirm-description">{description}</p>
  </Form></Modal>;
}

export const textValue = (data: FormData, name: string) => String(data.get(name) ?? '');
export const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Intl.DateTimeFormat(undefined, options).format(new Date(`${date.length === 7 ? `${date}-01` : date}T12:00:00`));
export const moneyLabel = (amount: number, currency: string) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
