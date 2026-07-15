// Fan belgisi — /tests va /done sahifalarida bir xil ko'rinsin.
// Ranglar tokenlardagi data-semantika to'plamidan (client bilan bir xil).

import type { Subject } from "@/lib/tests";

export const SUBJECT_TINT: Record<Subject, { bg: string; fg: string }> = {
  MATH: { bg: "var(--info-weak)", fg: "var(--info)" },
  ENGLISH: { bg: "var(--accent-weak)", fg: "var(--accent-ink)" },
  CRITICAL_THINKING: { bg: "var(--pos-weak)", fg: "var(--pos)" },
};

export function SubjectIcon({ subject, size = 22 }: { subject: Subject; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (subject === "MATH") {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="11" x2="10" y2="11" />
        <line x1="14" y1="11" x2="16" y2="11" />
        <line x1="8" y1="16" x2="10" y2="16" />
        <line x1="14" y1="16" x2="16" y2="16" />
      </svg>
    );
  }
  if (subject === "ENGLISH") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

/** Qulf belgisi — navbati kelmagan test uchun. */
export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Topshirilgan test belgisi. */
export function DoneIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
