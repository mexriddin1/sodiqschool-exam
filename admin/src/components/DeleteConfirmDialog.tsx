"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  title: string;           // e.g. "O'quvchini o'chirish"
  itemLabel: string;       // e.g. "Sample Student 1"
  description?: string;    // e.g. "Bu o'quvchi va uning barcha natijalari yo'q qilinadi."
  confirmWord?: string;    // override the typed-confirmation word; defaults to itemLabel
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

// Two-step delete: (1) modal with warning + red button, (2) user must type the
// item's name to enable the final destructive button. Closes on Escape, clicks
// outside, or Cancel. Does not auto-close on confirm so the caller can show a
// pending state.
export default function DeleteConfirmDialog({
  open, title, itemLabel, description, confirmWord, pending, onCancel, onConfirm,
}: Props) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const word = confirmWord ?? itemLabel;
  const canConfirm = typed.trim() === word.trim() && !pending;

  useEffect(() => {
    if (!open) { setStage(1); setTyped(""); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onCancel}>
      <div className="card w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="text-bad mt-0.5"><Icon name="warning" size={22} /></div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-navy">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-mono font-medium">{itemLabel}</span>
            </p>
          </div>
        </div>

        {stage === 1 && (
          <>
            <div className="text-sm text-gray-700 space-y-2">
              {description && <p>{description}</p>}
              <p className="text-bad">
                <Icon name="warning" size={14} className="inline-block mr-1" />
                Bu amalni qaytarib bo'lmaydi.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={onCancel}>Bekor qilish</button>
              <button type="button" className="btn-danger" onClick={() => setStage(2)}>Davom etish</button>
            </div>
          </>
        )}

        {stage === 2 && (
          <>
            <div className="text-sm text-gray-700">
              Tasdiqlash uchun <span className="font-mono font-medium">{word}</span> deb yozing:
            </div>
            <input
              autoFocus
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={word}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>Bekor</button>
              <button type="button" className="btn-danger" disabled={!canConfirm} onClick={() => onConfirm()}>
                {pending ? "O'chirilmoqda…" : "Yakuniy o'chirish"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
