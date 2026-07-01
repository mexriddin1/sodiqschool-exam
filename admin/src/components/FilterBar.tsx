"use client";

import { ReactNode } from "react";
import { Icon } from "./Icon";

interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  showReset?: boolean;
  stats?: ReactNode;
}

// Container for list-page filters. Keeps every page's filter UI consistent:
// flex row of selects/inputs on top, optional stats badge row underneath,
// "Filtrlarni tozalash" button on the right when any filter is active.
export default function FilterBar({ children, onReset, showReset, stats }: FilterBarProps) {
  return (
    <div className="card p-3 space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        {children}
        {onReset && showReset && (
          <button type="button" onClick={onReset} className="text-xs text-bad hover:underline self-end pb-2 inline-flex items-center gap-1">
            <Icon name="refresh" size={14} /> Filtrlarni tozalash
          </button>
        )}
      </div>
      {stats && <div className="flex flex-wrap gap-2 text-xs">{stats}</div>}
    </div>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ?? ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function StatBadge({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "primary" | "good" | "warn" | "orange" | "bad" }) {
  const map = {
    default: "bg-gray-100 text-gray-700",
    primary: "bg-navy text-white",
    good: "bg-good/10 text-good",
    warn: "bg-warn/10 text-warn",
    orange: "bg-orange/10 text-orange",
    bad: "bg-bad/10 text-bad",
  } as const;
  return <span className={`badge ${map[variant]}`}>{children}</span>;
}
