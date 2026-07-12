// First-party analytics client — the browser half of /api/track.
//
// Design goals, in order: never break the page (every call is fire-and-forget
// and wrapped in try/catch), never track localhost or automated browsers, and
// follow the existing localStorage conventions (ouss-portfolio-* keys,
// try/catch around storage access — see MODE_KEY in page.tsx).
//
// Identity model:
//   • visitor id (vid)  — localStorage, survives across visits
//   • session id (sid)  — sessionStorage, one per tab/browsing session
// Both are random UUIDs minted here; the server upserts on them, so a reload
// re-sending "start" updates the same rows instead of duplicating.

const VID_KEY = "ouss-portfolio-vid";
const SID_KEY = "ouss-portfolio-sid";

// Old single-PDF path kept so cached pages still classify as a CV download.
const CV_PATHS = ["/cven.pdf", "/cvfr.pdf", "/resume-ouss.pdf"];

let initialized = false;
let sessionStart = 0;
let lastSection = "";

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

/** Read-or-mint an id in the given storage. Returns "" if storage is blocked. */
function ensureId(storage: Storage, key: string): string {
  try {
    let v = storage.getItem(key);
    if (!v) {
      v = uuid();
      storage.setItem(key, v);
    }
    return v;
  } catch {
    return "";
  }
}

/** Current ids without minting — used to tag chat requests. */
export function getTrackIds(): { vid?: string; sid?: string } {
  try {
    return {
      vid: window.localStorage.getItem(VID_KEY) ?? undefined,
      sid: window.sessionStorage.getItem(SID_KEY) ?? undefined,
    };
  } catch {
    return {};
  }
}

function trackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return false;
  return true;
}

function post(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    // sendBeacon survives page unload; fetch keepalive is the fallback.
    if (
      navigator.sendBeacon &&
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))
    ) {
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // tracking must never throw into app code
  }
}

/** Log a discrete event (mode_toggle, cv_download, shell_command, …). */
export function trackEvent(type: string, payload?: Record<string, unknown>) {
  if (!initialized || !trackingEnabled()) return;
  const { vid, sid } = getTrackIds();
  if (!vid || !sid) return;
  post({ kind: "event", vid, sid, type, payload });
}

/** Section/workspace views, deduped against the last one reported. */
export function trackSection(section: string) {
  if (!section || section === lastSection) return;
  lastSection = section;
  trackEvent("section_view", { section });
}

/** Classify link clicks globally — one listener instead of edits at every anchor. */
function onDocumentClick(e: MouseEvent) {
  const anchor = (e.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const href = anchor.getAttribute("href") ?? "";

  if (href.startsWith("mailto:")) {
    trackEvent("contact_click", { channel: "email" });
    return;
  }
  try {
    const url = new URL(anchor.href, window.location.href);
    if (CV_PATHS.includes(url.pathname) || anchor.hasAttribute("download")) {
      trackEvent("cv_download", { lang: url.pathname === "/cvfr.pdf" ? "fr" : "en" });
      return;
    }
    if (url.host && url.host !== window.location.host) {
      const h = url.hostname.replace(/^www\./, "");
      const channel = h.includes("github.com")
        ? "github"
        : h.includes("linkedin.com")
          ? "linkedin"
          : h === "x.com" || h.includes("twitter.com")
            ? "x"
            : null;
      if (channel) trackEvent("contact_click", { channel });
      else trackEvent("outbound_click", { host: h });
    }
  } catch {
    // unparseable href — ignore
  }
}

/**
 * Boot the tracker: mint ids, report the session start (with referrer,
 * ?ref= campaign code, and utm params), and install unload + click listeners.
 * Call once from the root component's mount effect.
 */
export function initTracking(mode: string) {
  if (initialized || !trackingEnabled()) return;
  initialized = true;
  sessionStart = Date.now();

  const vid = ensureId(window.localStorage, VID_KEY);
  // If a sid already exists, this is a reload of the same session — the server
  // updates the session row instead of counting a fresh visit.
  let resumed = false;
  try {
    resumed = window.sessionStorage.getItem(SID_KEY) !== null;
  } catch {}
  const sid = ensureId(window.sessionStorage, SID_KEY);
  if (!vid || !sid) return;

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const [k, v] of params) {
    if (k.startsWith("utm_") && v) utm[k] = v.slice(0, 120);
  }

  post({
    kind: "start",
    vid,
    sid,
    resumed,
    referrer: document.referrer || undefined,
    refCode: params.get("ref")?.slice(0, 80) || undefined,
    utm: Object.keys(utm).length ? utm : undefined,
    path: window.location.pathname,
    mode,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  document.addEventListener("click", onDocumentClick, { capture: true, passive: true });

  // Report duration whenever the page is hidden (tab switch, close, navigate).
  const reportEnd = () => {
    const { vid: v, sid: s } = getTrackIds();
    if (!v || !s) return;
    post({ kind: "end", vid: v, sid: s, duration: Date.now() - sessionStart });
  };
  window.addEventListener("pagehide", reportEnd);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reportEnd();
  });
}
