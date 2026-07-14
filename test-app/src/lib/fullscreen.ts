// Fullscreen helpers. Different browsers still expose vendor-prefixed
// variants for iOS Safari, so we normalise them.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as any;
  return Boolean(
    document.fullscreenElement ||
      d.webkitFullscreenElement ||
      d.mozFullScreenElement ||
      d.msFullscreenElement,
  );
}

export async function requestFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const el = document.documentElement as any;
  const req: undefined | (() => Promise<void>) =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (req) {
    try { await req.call(el); } catch { /* user gesture required — caller retries */ }
  }
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const d = document as any;
  const exit: undefined | (() => Promise<void>) =
    document.exitFullscreen ||
    d.webkitExitFullscreen ||
    d.mozCancelFullScreen ||
    d.msExitFullscreen;
  if (exit) try { await exit.call(document); } catch { /* ignore */ }
}

export function onFullscreenChange(cb: () => void): () => void {
  const events = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
  events.forEach((e) => document.addEventListener(e, cb));
  return () => events.forEach((e) => document.removeEventListener(e, cb));
}
