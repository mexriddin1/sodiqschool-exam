// Tiny markdown-to-HTML renderer for AI narrative. Only supports `**bold**`
// and paragraph splitting — the AI is instructed to output nothing else.
// Everything else is HTML-escaped so raw user text can't inject tags.

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `**text**` → `<b>text</b>` after escaping the surrounding text. */
export function renderInline(s: string): string {
  return escape(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

/** Split AI narrative into paragraphs and pre-render each to safe HTML. */
export function aiParagraphs(t: string | undefined | null): string[] {
  if (!t) return [];
  return t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(renderInline);
}

/** True when the AI produced usable text (non-empty after trimming). */
export function hasAiText(t: string | undefined | null): boolean {
  return !!(t && t.trim().length > 20);
}
