"use client";

import Image from "next/image";
import {
  Bricolage_Grotesque,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  profile,
  projects,
  experience,
  testimonials,
  education,
  values,
} from "@/lib/portfolio";
import { initTracking, trackEvent, trackSection, getTrackIds } from "@/lib/track";

// ════════════════════════════════════════════════════════════════
// FONTS
// ════════════════════════════════════════════════════════════════

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--p-display",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--p-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--p-mono",
});

// ════════════════════════════════════════════════════════════════
// PALETTES
// ════════════════════════════════════════════════════════════════

// Paper mode — brutalist mono · off-white + near-black + one green accent
const paper = {
  bg: "#ECEBE4",
  panel: "#E2E0D6",
  ink: "#161512",
  inkSoft: "#59574D",
  accent: "#1FBF54",
  accentDk: "#0C5A2A",
  onAccent: "#08160C",
};

// Terminal mode — brutalist mono · the DARK SIBLING of paper mode.
// Built on warm near-black grounds + bone text, with paper's green (#1FBF54)
// as the single signature accent and ONE warm amber (#FFB000) for alerts /
// active states. The Catppuccin hue keys are kept (content references them by
// name) but remapped: every "accent" hue → green, every "warm" hue → amber,
// everything else → bone. Edit a value here and it ripples through the mode.
const cat = {
  // grounds — warm near-black (paper's warm off-white, inverted)
  crust: "#090A06", // page background (deepest)
  base: "#13140D", // window body / content ground
  mantle: "#0D0E07", // bars + inset panels (a hair below base)
  surface0: "#262719", // hairline borders · tag / kbd fills
  surface1: "#3A3B27", // crisp frame border
  surface2: "#4D4E37", // window controls · strongest line
  // text — bone scale (warm off-white → dim)
  text: "#E8E6DB",
  subtext1: "#CDCBBE",
  subtext0: "#A4A293",
  overlay1: "#767262",
  overlay0: "#585546",
  // accent — paper's green is the through-line that binds the two modes
  green: "#1FBF54",
  teal: "#1FBF54", // contact accent / CTA → same green
  sapphire: "#41CB6D", // mid phosphor green (fastfetch art, tags)
  sky: "#62DA8B", // light green (shell info / glow)
  blue: "#41CB6D", // → green
  mauve: "#1FBF54", // → green
  pink: "#1FBF54", // → green
  lavender: "#C4C2B3", // secondary bone (names, clock, paths)
  // the single warm alert — amber CRT
  yellow: "#FFB000",
  maroon: "#FFB000",
  red: "#FFB000", // errors fold into the one warm signal
  peach: "#BCB6A2", // quiet warm-bone label (a tone, NOT the alert)
};

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ════════════════════════════════════════════════════════════════
// WORKSPACES
// ════════════════════════════════════════════════════════════════

type WS = {
  n: number;
  slug: string;
  label: string;
  cmd: string;
  tone: string;
};

// One accent — paper's green — across every workspace. Identity comes from the
// number + label, not the hue (the brutalist-mono discipline shared with paper).
const workspaces: WS[] = [
  { n: 1, slug: "home", label: "Home", cmd: "~/home", tone: cat.green },
  { n: 2, slug: "work", label: "Work", cmd: "~/projects", tone: cat.green },
  { n: 3, slug: "career", label: "Career", cmd: "~/experience", tone: cat.green },
  { n: 4, slug: "reviews", label: "Reviews", cmd: "~/reviews", tone: cat.green },
  { n: 5, slug: "about", label: "About", cmd: "~/about", tone: cat.green },
  { n: 6, slug: "contact", label: "Contact", cmd: "~/contact", tone: cat.green },
];

const ARCH_LOGO = `       /\\
      /  \\
     /\\   \\
    /  \\   \\
   / /\\ \\   \\
  / /  \\ \\   \\
 / /    \\ \\   \\
/_/______\\_\\___\\`;

// ════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════

type Mode = "paper" | "terminal";
type Direction = "to-terminal" | "to-paper" | null;

// Persisted mode lives in localStorage and is read via useSyncExternalStore, which
// renders the server snapshot ("paper") during hydration then swaps to the stored
// value — no setState-in-effect, no hydration mismatch. writeStoredMode() persists
// and notifies subscribers (and other tabs via the native "storage" event).
const MODE_KEY = "ouss-portfolio-dual-mode";
const modeListeners = new Set<() => void>();

function subscribeMode(cb: () => void) {
  modeListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    modeListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readStoredMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "terminal" ? "terminal" : "paper";
  } catch {
    return "paper";
  }
}

function writeStoredMode(mode: Mode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {}
  modeListeners.forEach((cb) => cb());
  trackEvent("mode_toggle", { mode });
}

export default function DualPreview() {
  const reduced = useReducedMotion() ?? false;
  const mode = useSyncExternalStore(subscribeMode, readStoredMode, () => "paper" as Mode);
  const [transitioning, setTransitioning] = useState<Direction>(null);
  const paperScrollRef = useRef<HTMLDivElement | null>(null);

  // mode switch with orchestrated transition
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode || transitioning) return;
      const dir: Direction = next === "terminal" ? "to-terminal" : "to-paper";
      setTransitioning(dir);
      // The actual mode flip happens after the boot-line + flash midpoint.
      const flipDelay = reduced ? 90 : 175;
      const totalDelay = reduced ? 200 : 720;
      window.setTimeout(() => writeStoredMode(next), flipDelay);
      window.setTimeout(() => setTransitioning(null), totalDelay);
    },
    [mode, transitioning, reduced]
  );

  const toggleMode = useCallback(() => {
    switchMode(mode === "paper" ? "terminal" : "paper");
  }, [mode, switchMode]);

  // ── shared terminal-mode state (lifted so global key handler can see it)
  const [workspace, setWorkspace] = useState(1);
  const [workspaceDir, setWorkspaceDir] = useState<1 | -1>(1);
  const [shellOpen, setShellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const setWorkspaceWithDir = useCallback((next: number) => {
    setWorkspace((prev) => {
      if (next === prev) return prev;
      setWorkspaceDir(next > prev ? 1 : -1);
      trackSection(`terminal/${workspaces[next - 1]?.slug ?? next}`);
      return next;
    });
  }, []);

  // analytics boot — one session-start beacon per mount (no-op on localhost)
  useEffect(() => {
    initTracking(readStoredMode());
  }, []);

  // global keydown — cross-mode toggle, vim nav (terminal only)
  const lastKey = useRef("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";

      // Esc
      if (e.key === "Escape") {
        if (mode === "terminal") {
          if (shellOpen) {
            setShellOpen(false);
            return;
          }
          if (helpOpen) {
            setHelpOpen(false);
            return;
          }
          // back to paper
          switchMode("paper");
          return;
        }
        return;
      }

      // backtick
      if (e.key === "`" && !isTyping) {
        e.preventDefault();
        if (mode === "paper") {
          switchMode("terminal");
        } else {
          setShellOpen((v) => !v);
        }
        return;
      }

      // Vim-nav only in terminal mode, not while typing, not in transition
      if (mode !== "terminal" || isTyping || transitioning) return;

      // help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      // workspace nav
      if (/^[1-6]$/.test(e.key)) {
        setWorkspaceWithDir(Number(e.key));
        return;
      }
      if (e.key === "h") {
        setWorkspaceWithDir(Math.max(1, workspace - 1));
        return;
      }
      if (e.key === "l") {
        setWorkspaceWithDir(Math.min(6, workspace + 1));
        return;
      }
      // open shell with `:` or `i`
      if (e.key === ":" || e.key === "i") {
        e.preventDefault();
        setShellOpen(true);
        return;
      }

      // gg / G
      if (e.key === "g") {
        if (lastKey.current === "g") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          lastKey.current = "";
        } else {
          lastKey.current = "g";
          window.setTimeout(() => {
            if (lastKey.current === "g") lastKey.current = "";
          }, 600);
        }
        return;
      }
      if (e.key === "G") {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        return;
      }
      // j/k page scroll
      if (e.key === "j") {
        window.scrollBy({ top: 60, behavior: "smooth" });
        return;
      }
      if (e.key === "k") {
        window.scrollBy({ top: -60, behavior: "smooth" });
        return;
      }
      lastKey.current = "";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, shellOpen, helpOpen, transitioning, workspace, switchMode, setWorkspaceWithDir]);

  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} relative`}
      style={{
        height: "100dvh",
        minHeight: "560px",
        overflow: "hidden",
        background: mode === "paper" ? paper.bg : cat.crust,
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[300] focus:px-4 focus:py-2 focus:rounded-md focus:bg-black focus:text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{ fontFamily: "var(--p-mono), ui-monospace, monospace", fontSize: 13 }}
      >
        Skip to content
      </a>
      {/* Both modes mounted; visibility controlled by translateX on wrapper */}
      <div id="main" className="relative w-full h-full">
        <motion.div
          ref={paperScrollRef}
          aria-hidden={mode !== "paper"}
          initial={false}
          animate={{ x: mode === "paper" ? 0 : "-100%" }}
          transition={
            reduced
              ? { duration: 0.18, ease }
              : { duration: 0.55, ease, delay: mode === "paper" ? 0.18 : 0 }
          }
          className="absolute inset-0 overflow-y-auto"
          style={{
            pointerEvents: mode === "paper" ? "auto" : "none",
            // Smooth anchor jumps; the reduced-motion net in globals.css overrides this.
            scrollBehavior: "smooth",
          }}
        >
          <PaperMode onToggle={toggleMode} scrollRef={paperScrollRef} />
        </motion.div>
        <motion.div
          aria-hidden={mode !== "terminal"}
          initial={false}
          animate={{ x: mode === "terminal" ? 0 : "100%" }}
          transition={
            reduced
              ? { duration: 0.18, ease }
              : { duration: 0.55, ease, delay: mode === "terminal" ? 0.18 : 0 }
          }
          className="absolute inset-0 overflow-y-auto"
          style={{ pointerEvents: mode === "terminal" ? "auto" : "none" }}
        >
          <TerminalMode
            onToggle={toggleMode}
            workspace={workspace}
            workspaceDir={workspaceDir}
            setWorkspace={setWorkspaceWithDir}
            shellOpen={shellOpen}
            setShellOpen={setShellOpen}
            helpOpen={helpOpen}
            setHelpOpen={setHelpOpen}
          />
        </motion.div>
      </div>

      {/* Transition orchestration overlay */}
      <TransitionOverlay direction={transitioning} reduced={reduced} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TRANSITION OVERLAY (boot-line · scanline · brightness flash)
// ════════════════════════════════════════════════════════════════

function TransitionOverlay({
  direction,
  reduced,
}: {
  direction: Direction;
  reduced: boolean;
}) {
  const active = direction !== null;
  return (
    <>
      {/* boot-line echo at top */}
      <AnimatePresence>
        {active ? (
          <motion.div
            key="boot"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center pt-2"
            style={{
              fontFamily: "var(--p-mono), ui-monospace, monospace",
              fontSize: "12px",
              color: cat.lavender,
              textShadow: `0 0 12px ${cat.crust}`,
            }}
          >
            <span
              className="px-3 py-1 rounded-md"
              style={{
                background: cat.crust,
                color: cat.text,
                border: `1px solid ${cat.surface1}`,
              }}
            >
              <span style={{ color: cat.green }} aria-hidden>❯</span>{" "}
              <span style={{ color: cat.subtext0 }}>hyprctl dispatch workspace</span>{" "}
              <span style={{ color: cat.peach, fontWeight: 700 }}>
                {direction === "to-terminal" ? "terminal" : "paper"}
              </span>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* scanline sweep */}
      <AnimatePresence>
        {active && !reduced ? (
          <motion.div
            key="scanline"
            initial={{ y: "-2px", opacity: 0.9 }}
            animate={{ y: "100vh", opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: "linear" }}
            className="pointer-events-none fixed inset-x-0 z-[201]"
            style={{
              top: 0,
              height: 2,
              background: cat.sapphire,
              boxShadow: `0 0 18px ${cat.sapphire}, 0 0 4px ${cat.sapphire}`,
            }}
          />
        ) : null}
      </AnimatePresence>

      {/* brightness flash at midpoint */}
      <AnimatePresence>
        {active && !reduced ? (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.32, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, times: [0, 0.4, 0.55, 1] }}
            className="pointer-events-none fixed inset-0 z-[199]"
            style={{
              background:
                direction === "to-terminal"
                  ? cat.sapphire
                  : paper.accent,
              mixBlendMode: "soft-light",
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// PAPER MODE — brutalist mono · photo-led editorial
// ════════════════════════════════════════════════════════════════

const FD = "var(--p-display), 'Arial Narrow', sans-serif";
const FM = "var(--p-mono), ui-monospace, monospace";
const FB = "var(--p-body), ui-sans-serif, system-ui, sans-serif";
const HAIR = `1px solid ${paper.ink}`;

// Résumé / CV — one PDF lives in /public; surfaced as a download in both modes.
const CV_PATH = "/resume-ouss.pdf";
const CV_FILE = "Oussama-Benberkane-CV.pdf";

// paper.bg (#ECEBE4) with alpha — for textures/labels over dark poster tiles
const paperA = (a: number) => `rgba(236, 235, 228, ${a})`;
// First letters of up to two words → monogram for generated project posters
function monogram(title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

const SOCIAL_ABBR: Record<string, string> = {
  GitHub: "GH",
  LinkedIn: "LI",
  "X / Twitter": "X",
  Email: "✉",
};

// Brand lockup — circular avatar mark (ouss-logo.png) + lowercase wordmark matching
// the domain/handle (oussamabenberkane). `invert` flips the wordmark color for dark
// surfaces (Footer); the avatar stays full-colour. The favicon (src/app/icon.png)
// is the same avatar. `priority` eager-loads it for the above-the-fold TopBar.
function BrandLogo({
  invert = false,
  priority = false,
}: {
  invert?: boolean;
  priority?: boolean;
}) {
  const wordColor = invert ? paper.bg : paper.ink;
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/ouss-logo.png"
        alt=""
        width={42}
        height={42}
        priority={priority}
        sizes="42px"
        className="bx-logo-mark rounded-full"
        style={{
          display: "block",
          flexShrink: 0,
          width: 42,
          height: 42,
        }}
      />
      {/* The wordmark yields to the avatar alone on the narrowest screens */}
      <span
        className="lowercase hidden min-[380px]:inline"
        style={{
          fontFamily: FM,
          fontSize: 14.5,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: wordColor,
          whiteSpace: "nowrap",
        }}
      >
        oussamabenberkane
      </span>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// ASK OUSS — paper-mode grounded chatbot (launcher + portaled panel)
// Backend is one-shot (POST /api/chat → { reply }); the UI fakes streaming
// with a typewriter reveal + blinking block caret. Brutalist-mono throughout.
// ════════════════════════════════════════════════════════════════

type AskMsg = { role: "user" | "assistant"; content: string };

const ASK_SUGGESTIONS = [
  "What has Ouss built?",
  "Tell me about the Wedey project.",
  "What's his tech stack?",
  "Is he available for work?",
  "What languages does he speak?",
];

// ── Markdown (ported from orkestra, restyled brutalist-mono). Zero-dep:
// handles bold/italic/inline-code, links, fenced code, headings, lists,
// blockquotes, hr, paragraphs. No tables / no full CommonMark — kept small.
type AskInline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; children: AskInline[] }
  | { type: "italic"; children: AskInline[] }
  | { type: "link"; href: string; children: AskInline[] };

function parseAskInline(input: string): AskInline[] {
  const out: AskInline[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ type: "text", value: buf });
      buf = "";
    }
  };

  while (i < input.length) {
    const c = input[i];

    if (c === "`") {
      const end = input.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ type: "code", value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (c === "*" && input[i + 1] === "*") {
      const end = input.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "bold", children: parseAskInline(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (c === "*") {
      const end = input.indexOf("*", i + 1);
      if (end > i + 1 && input[i + 1] !== " " && input[end - 1] !== " ") {
        flush();
        out.push({ type: "italic", children: parseAskInline(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    // [label](href)
    if (c === "[") {
      const close = input.indexOf("]", i + 1);
      if (close > i && input[close + 1] === "(") {
        const urlEnd = input.indexOf(")", close + 2);
        if (urlEnd > close) {
          flush();
          out.push({
            type: "link",
            href: input.slice(close + 2, urlEnd).trim(),
            children: parseAskInline(input.slice(i + 1, close)),
          });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

function renderAskInline(nodes: AskInline[], keyPrefix = ""): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${keyPrefix}${i}`;
    switch (n.type) {
      case "text":
        return <Fragment key={k}>{n.value}</Fragment>;
      case "code":
        return (
          <code
            key={k}
            style={{
              fontFamily: FM,
              fontSize: "0.86em",
              background: paper.bg,
              border: `1px solid ${paper.ink}`,
              padding: "0.04em 0.34em",
            }}
          >
            {n.value}
          </code>
        );
      case "bold":
        return (
          <strong key={k} style={{ fontWeight: 700 }}>
            {renderAskInline(n.children, `${k}b`)}
          </strong>
        );
      case "italic":
        return (
          <em key={k} style={{ fontStyle: "italic" }}>
            {renderAskInline(n.children, `${k}i`)}
          </em>
        );
      case "link": {
        const external = /^https?:/.test(n.href);
        return (
          <a
            key={k}
            href={n.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="bx-link"
            style={{ color: paper.accentDk, fontWeight: 600 }}
          >
            {renderAskInline(n.children, `${k}l`)}
          </a>
        );
      }
    }
  });
}

type AskBlock =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "fence"; code: string }
  | { type: "hr" };

function parseAskBlocks(source: string): AskBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: AskBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "fence", code: code.join("\n") });
      continue;
    }

    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: `h${level}` as "h1" | "h2" | "h3", text: h[2].trim() });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: buf.join("\n") });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join(" ") });
  }

  return blocks;
}

function renderAskBlock(b: AskBlock, key: number): React.ReactNode {
  switch (b.type) {
    case "h1":
    case "h2":
      return (
        <p
          key={key}
          style={{
            fontFamily: FB,
            fontSize: b.type === "h1" ? "1.05rem" : "0.96rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
            margin: "0.7rem 0 0.35rem",
          }}
        >
          {renderAskInline(parseAskInline(b.text), `${b.type}-${key}-`)}
        </p>
      );
    case "h3":
      return (
        <p
          key={key}
          className="uppercase"
          style={{
            fontFamily: FM,
            fontSize: "0.72rem",
            fontWeight: 700,
            color: paper.accentDk,
            letterSpacing: "0.08em",
            margin: "0.7rem 0 0.3rem",
          }}
        >
          {renderAskInline(parseAskInline(b.text), `h3-${key}-`)}
        </p>
      );
    case "paragraph":
      return (
        <p key={key} style={{ margin: "0.4rem 0", lineHeight: 1.6 }}>
          {renderAskInline(parseAskInline(b.text), `p-${key}-`)}
        </p>
      );
    case "ul":
      return (
        <ul
          key={key}
          style={{
            margin: "0.4rem 0",
            paddingLeft: "1.1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
            listStyle: "none",
          }}
        >
          {b.items.map((it, i) => (
            <li
              key={i}
              style={{ position: "relative", paddingLeft: "0.2rem", lineHeight: 1.55 }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "-0.85rem",
                  top: "0.55em",
                  width: 6,
                  height: 6,
                  background: paper.accent,
                  border: `1px solid ${paper.ink}`,
                }}
              />
              {renderAskInline(parseAskInline(it), `ul-${key}-${i}-`)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol
          key={key}
          style={{
            margin: "0.4rem 0",
            paddingLeft: "1.4rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
            lineHeight: 1.55,
          }}
        >
          {b.items.map((it, i) => (
            <li key={i}>{renderAskInline(parseAskInline(it), `ol-${key}-${i}-`)}</li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote
          key={key}
          style={{
            margin: "0.55rem 0",
            padding: "0.45rem 0.75rem",
            borderLeft: `3px solid ${paper.accent}`,
            background: paper.bg,
            color: paper.inkSoft,
            lineHeight: 1.55,
          }}
        >
          {renderAskInline(parseAskInline(b.text), `bq-${key}-`)}
        </blockquote>
      );
    case "fence":
      return (
        <pre
          key={key}
          style={{
            margin: "0.55rem 0",
            padding: "0.7rem 0.85rem",
            background: paper.ink,
            color: paper.bg,
            border: `1.5px solid ${paper.ink}`,
            overflow: "auto",
            fontFamily: FM,
            fontSize: "0.8rem",
            lineHeight: 1.55,
          }}
        >
          <code style={{ fontFamily: "inherit", color: "inherit" }}>{b.code}</code>
        </pre>
      );
    case "hr":
      return (
        <hr
          key={key}
          style={{ margin: "0.7rem 0", border: "none", height: 1, background: paper.ink }}
        />
      );
  }
}

function AskMarkdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseAskBlocks(source), [source]);
  return (
    <div
      className="ask-md"
      style={{ fontFamily: FB, fontSize: 14, color: paper.ink, minWidth: 0 }}
    >
      <style>{`
        .ask-md > :first-child { margin-top: 0; }
        .ask-md > :last-child { margin-bottom: 0; }
        .ask-md p, .ask-md li, .ask-md blockquote { overflow-wrap: break-word; }
        .ask-md pre { max-width: 100%; }
        .ask-md a { overflow-wrap: anywhere; }
      `}</style>
      {blocks.map((b, i) => renderAskBlock(b, i))}
    </div>
  );
}

// ── Three bouncing accent dots while awaiting the first revealed char.
function AskThinkingDots() {
  const reduced = useReducedMotion();
  return (
    <div
      className="flex items-center gap-1.5 px-1"
      role="status"
      aria-label="Thinking"
    >
      {[0, 1, 2].map((d) => (
        <motion.span
          key={d}
          style={{ width: 7, height: 7, background: paper.accent, border: `1px solid ${paper.ink}` }}
          animate={reduced ? { opacity: [0.4, 1, 0.4] } : { y: [0, -5, 0] }}
          transition={{
            duration: reduced ? 1 : 0.66,
            ease: "easeInOut",
            repeat: Infinity,
            delay: d * 0.14,
          }}
        />
      ))}
    </div>
  );
}

function AskUserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        style={{
          maxWidth: "86%",
          background: "rgba(31, 191, 84, 0.16)",
          border: `1.5px solid ${paper.ink}`,
          boxShadow: `3px 3px 0 ${paper.ink}`,
          padding: "0.55rem 0.75rem",
          fontFamily: FB,
          fontSize: 14,
          lineHeight: 1.5,
          color: paper.ink,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </div>
    </div>
  );
}

// Left card. While `revealing`, append a blinking block caret to the source so
// the markdown renders the progressively-growing string with a trailing ▋.
function AskAssistantBubble({ content, revealing }: { content: string; revealing: boolean }) {
  const reduced = useReducedMotion();
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    if (!revealing || reduced) return;
    const id = window.setInterval(() => setBlink((b) => !b), 530);
    return () => window.clearInterval(id);
  }, [revealing, reduced]);
  const showCaret = revealing && !reduced;
  const src = showCaret ? content + (blink ? "▋" : "​") : content;
  return (
    <div className="flex justify-start">
      <div
        style={{
          maxWidth: "94%",
          background: paper.panel,
          border: `1.5px solid ${paper.ink}`,
          boxShadow: `3px 3px 0 ${paper.ink}`,
          padding: "0.6rem 0.8rem",
        }}
      >
        <AskMarkdown source={src} />
      </div>
    </div>
  );
}

function AskLauncher({ onOpen }: { onOpen: () => void }) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label="Ask about Ouss — open chat"
      className="fixed z-40 inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        right: "clamp(16px, 4vw, 24px)",
        bottom: "clamp(16px, 4vw, 24px)",
        background: paper.accent,
        color: paper.onAccent,
        border: `1.5px solid ${paper.ink}`,
        boxShadow: `6px 6px 0 ${paper.ink}`,
        padding: "0.6rem 0.9rem",
        fontFamily: FM,
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.5, ease, delay: reduced ? 0.2 : 0.9 }}
      whileHover={reduced ? undefined : { x: -2, y: -2 }}
      whileTap={reduced ? undefined : { x: 1, y: 1 }}
    >
      <span aria-hidden>▸</span>
      Ask about Ouss
    </motion.button>
  );
}

function AskPanel({
  open,
  onClose,
  scrollRef,
}: {
  open: boolean;
  onClose: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<AskMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Index of the assistant message currently typewriter-revealing (null = none).
  const [revealIdx, setRevealIdx] = useState<number | null>(null);
  const [revealLen, setRevealLen] = useState(0);

  // Portal overlay lifecycle: capture-phase Esc/backtick (so the global vim
  // handler never fires), Tab trap, scroll-lock the paper scroller, restore focus.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const scroller = scrollRef.current;
    const prevOverflow = scroller?.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      // Swallow the backtick mode-toggle unless the user is typing it into the textarea.
      if (e.key === "`" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Tab") trapTab(e, panelRef.current);
    };
    window.addEventListener("keydown", onKey, true);
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
      if (scroller) scroller.style.overflow = prevOverflow ?? "";
      abortRef.current?.abort();
      opener?.focus?.();
    };
  }, [open, onClose, scrollRef]);

  // Typewriter reveal — time-based, ~upper-bound chars/s, clamped so long
  // replies don't drag. Reduced motion renders instantly (handled at send()).
  useEffect(() => {
    if (revealIdx === null) return;
    const full = messages[revealIdx]?.content ?? "";
    if (!full) return; // never set for empty replies — send() guards on reply.trim()
    const rate = Math.max(55, full.length / 4); // chars/sec, ≤ ~4s total
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const n = Math.min(full.length, Math.floor(((now - start) / 1000) * rate));
      setRevealLen(n);
      if (n < full.length) raf = requestAnimationFrame(tick);
      else setRevealIdx(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealIdx, messages]);

  // Smart autoscroll — only pin to bottom if the user is already near it.
  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    const el = listRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, revealLen, loading]);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || loading) return;
      setError(null);
      const next: AskMsg[] = [...messages, { role: "user", content }];
      setMessages(next);
      setInput("");
      pinnedRef.current = true;
      setLoading(true);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, ...getTrackIds() }),
          signal: ac.signal,
        });
        if (!res.ok) {
          setLoading(false);
          setError(
            res.status === 429
              ? "You're sending messages too fast — give it a moment."
              : "Something went wrong. Try again."
          );
          return;
        }
        const data = (await res.json().catch(() => null)) as { reply?: string } | null;
        const reply = (data?.reply ?? "").toString();
        setLoading(false);
        if (!reply.trim()) {
          setError("Something went wrong. Try again.");
          return;
        }
        const assistantIdx = next.length;
        setMessages([...next, { role: "assistant", content: reply }]);
        if (reduced) {
          setRevealIdx(null);
          setRevealLen(reply.length);
        } else {
          setRevealLen(0);
          setRevealIdx(assistantIdx);
        }
      } catch {
        if (ac.signal.aborted) return;
        setLoading(false);
        setError("Something went wrong. Try again.");
      }
    },
    [loading, messages, reduced]
  );

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  // Autogrow the textarea, clamped.
  const autogrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  };

  const canSend = input.trim().length > 0 && !loading;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
      <motion.div
        key="ask-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-panel-title"
        className="fixed z-[150] flex flex-col inset-x-0 bottom-0 sm:inset-x-auto sm:right-5 sm:bottom-5"
        style={{
          width: "100%",
          maxWidth: "min(420px, 100vw)",
          height: "min(85vh, 560px)",
          background: paper.bg,
          color: paper.ink,
          border: `1.5px solid ${paper.ink}`,
          boxShadow: `8px 8px 0 ${paper.ink}`,
          fontFamily: FB,
        }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: reduced ? 0.16 : 0.28, ease }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: HAIR }}
        >
          <div className="min-w-0">
            <div
              id="ask-panel-title"
              className="flex items-center gap-2 uppercase"
              style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.16em", fontWeight: 700 }}
            >
              <span
                aria-hidden
                style={{ width: 8, height: 8, background: paper.accent, border: `1px solid ${paper.ink}` }}
              />
              <span>
                Ask <span style={{ color: paper.accentDk }}>· Ouss</span>
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 12, color: paper.inkSoft, lineHeight: 1.4 }}>
              A grounded guide to my work &amp; background.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              width: 34,
              height: 34,
              background: paper.bg,
              border: HAIR,
              boxShadow: `3px 3px 0 ${paper.ink}`,
              fontFamily: FM,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Message list */}
        <div
          ref={listRef}
          onScroll={onListScroll}
          className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
          style={{ overscrollBehavior: "contain" }}
        >
          {messages.length === 0 ? (
            <AskEmptyState onPick={(q) => void send(q)} />
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <AskUserBubble key={i} content={m.content} />
              ) : (
                <AskAssistantBubble
                  key={i}
                  revealing={revealIdx === i}
                  content={revealIdx === i ? m.content.slice(0, revealLen) : m.content}
                />
              )
            )
          )}
          {loading ? (
            <div className="flex justify-start">
              <div
                style={{
                  background: paper.panel,
                  border: `1.5px solid ${paper.ink}`,
                  boxShadow: `3px 3px 0 ${paper.ink}`,
                  padding: "0.6rem 0.8rem",
                }}
              >
                <AskThinkingDots />
              </div>
            </div>
          ) : null}
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error ? (
            <motion.div
              key="ask-error"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.12 : 0.2, ease }}
              role="alert"
              className="flex items-center justify-between gap-3 mx-4 mb-2 px-3 py-2 shrink-0"
              style={{
                background: paper.bg,
                border: `1.5px solid ${paper.ink}`,
                boxShadow: `3px 3px 0 ${paper.accent}`,
              }}
            >
              <span style={{ fontFamily: FM, fontSize: 11.5, lineHeight: 1.4, color: paper.ink }}>
                {error}
              </span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, lineHeight: 1, color: paper.inkSoft }}
              >
                ✕
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Composer */}
        <div className="px-4 pt-3 pb-3 shrink-0" style={{ borderTop: HAIR }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autogrow(e.target);
              }}
              onKeyDown={onInputKeyDown}
              rows={1}
              placeholder="Ask about Ouss…"
              aria-label="Ask a question about Ouss"
              className="flex-1 resize-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: paper.bg,
                border: `1.5px solid ${paper.ink}`,
                padding: "0.5rem 0.6rem",
                fontFamily: FB,
                fontSize: 14,
                lineHeight: 1.45,
                color: paper.ink,
                maxHeight: 132,
              }}
            />
            <motion.button
              type="button"
              onClick={() => void send(input)}
              disabled={!canSend}
              aria-label="Send message"
              className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                alignSelf: "stretch",
                padding: "0 0.85rem",
                background: canSend ? paper.accent : paper.panel,
                color: canSend ? paper.onAccent : paper.inkSoft,
                border: `1.5px solid ${canSend ? paper.ink : paper.inkSoft}`,
                boxShadow: canSend ? `3px 3px 0 ${paper.ink}` : "none",
                fontFamily: FM,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: canSend ? "pointer" : "not-allowed",
              }}
              whileHover={reduced || !canSend ? undefined : { x: -2, y: -2 }}
              whileTap={reduced || !canSend ? undefined : { x: 1, y: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              Send
            </motion.button>
          </div>
          <div
            className="mt-2"
            style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.06em", color: paper.inkSoft }}
          >
            ↵ send · ⇧↵ newline
          </div>
        </div>
      </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function AskEmptyState({ onPick }: { onPick: (q: string) => void }) {
  const reduced = useReducedMotion();
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.05, delayChildren: reduced ? 0 : 0.06 } },
  };
  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.18 } } }
    : {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
      };
  return (
    <div className="flex flex-col gap-3">
      <div
        className="uppercase"
        style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.14em", color: paper.accentDk, fontWeight: 700 }}
      >
        Start here
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: paper.ink }}>
        Ask me anything about Ouss&apos;s work, experience, or background.
      </p>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2 mt-1"
      >
        {ASK_SUGGESTIONS.map((q) => (
          <motion.button
            key={q}
            type="button"
            variants={item}
            onClick={() => onPick(q)}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: paper.bg,
              border: `1.5px solid ${paper.ink}`,
              padding: "0.5rem 0.7rem",
              fontFamily: FM,
              fontSize: 12,
              lineHeight: 1.4,
              color: paper.ink,
            }}
            whileHover={reduced ? undefined : { x: -2, y: -2, boxShadow: `4px 4px 0 ${paper.ink}` }}
            whileTap={reduced ? undefined : { x: 1, y: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
          >
            <span aria-hidden style={{ color: paper.accentDk }}>
              ▸{" "}
            </span>
            {q}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// Mounted inside PaperMode (inert in terminal mode). The launcher only renders
// in paper mode; the portaled panel self-closes if the mode flips while open.
function AskWidget({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const mode = useSyncExternalStore(subscribeMode, readStoredMode, () => "paper" as Mode);
  const [open, setOpen] = useState(false);
  const isPaper = mode === "paper";

  // `open && isPaper` derives the panel's visibility so a mode flip animates it
  // shut and unmounts the portaled card (no setState-in-effect needed). The
  // launcher only renders in paper mode; in terminal mode PaperMode is inert.
  return (
    <>
      {isPaper ? <AskLauncher onOpen={() => setOpen(true)} /> : null}
      <AskPanel open={open && isPaper} onClose={() => setOpen(false)} scrollRef={scrollRef} />
    </>
  );
}

function PaperMode({
  onToggle,
  scrollRef,
}: {
  onToggle: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState<(typeof projects)[number] | null>(null);
  return (
    <main
      className="relative min-h-full"
      style={{ background: paper.bg, color: paper.ink, fontFamily: FB }}
    >
      <PaperGrain />
      <TopBar onToggle={onToggle} scrollRef={scrollRef} />
      <Hero />
      <Works onOpen={setActive} />
      <Exp />
      <About />
      <Studies />
      <Contact />
      <Footer />
      <AskWidget scrollRef={scrollRef} />
      <ProjectDetail
        project={active}
        onClose={() => setActive(null)}
        scrollRef={scrollRef}
      />
    </main>
  );
}

function PaperGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{
        opacity: 0.05,
        mixBlendMode: "multiply",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>\")",
      }}
    />
  );
}

// ───────────────────────── shared bits ─────────────────────────

// Keep Tab cycling inside an open overlay (case-study dialog, mobile menu).
// Called from capture-phase keydown handlers while the overlay is mounted.
function trapTab(e: KeyboardEvent, container: HTMLElement | null) {
  if (!container) return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'
    )
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

function Pill({
  href,
  label,
  shadow = paper.ink,
}: {
  href: string;
  label: string;
  shadow?: string;
}) {
  const reduced = useReducedMotion();
  const external = href.startsWith("http");
  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      whileHover={reduced ? undefined : { x: -2, y: -2 }}
      whileTap={reduced ? undefined : { x: 1, y: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="inline-flex items-center gap-2 px-4 py-2.5 uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: paper.accent,
        color: paper.onAccent,
        border: `1.5px solid ${paper.ink}`,
        boxShadow: `4px 4px 0 ${shadow}`,
        fontFamily: FM,
        fontSize: 12,
        letterSpacing: "0.12em",
        fontWeight: 700,
      }}
    >
      {label}
      <span aria-hidden>↗</span>
    </motion.a>
  );
}

// Résumé download — a two-part brutalist button echoing the TopBar terminal
// toggle (label slab + accent square). The ↓ glyph bobs on hover (the download
// gesture, see .cv-dl in globals.css). `tone` adapts the frame + label to the
// ground it sits on: "dark" = over paper.ink (Contact), "light" = over paper.bg
// (TopBar). `compact` drops the "PDF" tag for tight spots like the bar.
function CvButton({
  tone = "dark",
  compact = false,
}: {
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const fg = tone === "dark" ? paper.bg : paper.ink;
  return (
    <motion.a
      href={CV_PATH}
      download={CV_FILE}
      aria-label="Download résumé (PDF)"
      title="Download résumé (PDF)"
      whileHover={reduced ? undefined : { x: -2, y: -2 }}
      whileTap={reduced ? undefined : { x: 1, y: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="cv-dl inline-flex items-stretch shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        border: `1.5px solid ${fg}`,
        boxShadow: `4px 4px 0 ${paper.accent}`,
        fontFamily: FM,
        minHeight: 36,
      }}
    >
      <span
        className="flex items-center px-3 uppercase"
        style={{ color: fg, fontSize: 12, letterSpacing: "0.12em", fontWeight: 700 }}
      >
        {compact ? "CV" : "Résumé"}
        {!compact && (
          <span className="ml-2" style={{ opacity: 0.5, fontWeight: 600, letterSpacing: "0.1em" }}>
            PDF
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="flex items-center justify-center px-2.5"
        style={{ background: paper.accent, color: paper.onAccent, fontSize: 14, fontWeight: 800 }}
      >
        <span className="cv-arrow">↓</span>
      </span>
    </motion.a>
  );
}

function Tag({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className="inline-block px-2 py-0.5 uppercase"
      style={{
        border: "1px solid currentColor",
        fontFamily: FM,
        fontSize: 10,
        letterSpacing: "0.1em",
        fontWeight: 600,
        lineHeight: 1.5,
        ...(accent
          ? { background: paper.accent, color: paper.onAccent, borderColor: paper.ink }
          : {}),
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({
  num,
  title,
  kicker,
}: {
  num: string;
  title: string;
  kicker?: string;
}) {
  return (
    <div
      className="flex items-end justify-between gap-4"
      style={{ borderBottom: HAIR, paddingBottom: 14 }}
    >
      <div className="flex items-baseline gap-3 sm:gap-4">
        <span
          style={{
            fontFamily: FM,
            fontSize: 13,
            fontWeight: 700,
            color: paper.accentDk,
            letterSpacing: "0.06em",
          }}
        >
          ({num})
        </span>
        <h2
          className="uppercase"
          style={{
            fontFamily: FD,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 0.9,
            fontSize: "clamp(1.8rem, 4.5vw, 3.4rem)",
          }}
        >
          {title}
        </h2>
      </div>
      {kicker ? (
        <span
          className="hidden sm:block pb-1 text-right"
          style={{
            fontFamily: FM,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: paper.inkSoft,
            fontWeight: 600,
          }}
        >
          {kicker}
        </span>
      ) : null}
    </div>
  );
}

// ───────────────────────────── top bar ─────────────────────────

const PAPER_NAV = [
  { href: "#works", label: "Works" },
  { href: "#experience", label: "Experience" },
  { href: "#about", label: "About" },
  { href: "#studies", label: "Studies" },
  { href: "#contact", label: "Contact" },
];

function TopBar({
  onToggle,
  scrollRef,
}: {
  onToggle: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("");

  // Scrollspy — the section crossing a narrow band near the top of the paper
  // scroll container is "current"; its nav link keeps the underline + accent.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const targets = PAPER_NAV.map((n) =>
      document.getElementById(n.href.slice(1))
    ).filter((el): el is HTMLElement => !!el);
    const inView = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) inView.add(en.target.id);
          else inView.delete(en.target.id);
        }
        const current = PAPER_NAV.find((n) => inView.has(n.href.slice(1)));
        setActiveId(current ? current.href.slice(1) : "");
        if (current) trackSection(`paper/${current.href.slice(1)}`);
      },
      { root, rootMargin: "-15% 0px -75% 0px" }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [scrollRef]);

  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: paper.bg, borderBottom: HAIR }}
    >
      <div className="flex items-center justify-between gap-4 px-5 sm:px-8 lg:px-12 h-14">
        <a
          href="#top"
          aria-label="oussamabenberkane — back to top"
          className="bx-logo flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <BrandLogo priority />
        </a>

        <nav
          className="hidden md:flex items-center gap-5 lg:gap-7"
          style={{ fontFamily: FM }}
          aria-label="Sections"
        >
          {PAPER_NAV.map((n) => {
            const isActive = activeId === n.href.slice(1);
            return (
              <a
                key={n.href}
                href={n.href}
                aria-current={isActive ? "true" : undefined}
                className="bx-link uppercase"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  fontWeight: 600,
                  color: isActive ? paper.accentDk : undefined,
                  backgroundSize: isActive ? "100% 1px" : undefined,
                }}
              >
                {n.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* CV moves into the mobile menu below md — keeps the bar from overflowing */}
          <span className="hidden md:flex">
            <CvButton tone="light" compact />
          </span>

          <motion.button
            onClick={onToggle}
            aria-label="Switch to terminal mode"
            aria-keyshortcuts="`"
            title="Press ` (backtick) to switch"
            whileHover={reduced ? undefined : { x: -1.5, y: -1.5 }}
            whileTap={reduced ? undefined : { x: 1, y: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="inline-flex items-stretch shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              border: HAIR,
              fontFamily: FM,
              boxShadow: `3px 3px 0 ${paper.ink}`,
              minHeight: 36,
            }}
          >
            <span
              className="flex items-center px-2.5 uppercase"
              style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 700 }}
            >
              <span className="hidden sm:inline">Terminal</span>
              <span className="sm:hidden">Term</span>
            </span>
            <span
              aria-hidden
              className="hidden sm:flex items-center justify-center px-2"
              style={{ background: paper.ink, color: paper.bg, fontSize: 12, fontWeight: 700 }}
            >
              `
            </span>
          </motion.button>

          <motion.button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="paper-mobile-menu"
            whileHover={reduced ? undefined : { x: -1.5, y: -1.5 }}
            whileTap={reduced ? undefined : { x: 1, y: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="md:hidden inline-flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              border: HAIR,
              boxShadow: `3px 3px 0 ${paper.ink}`,
              width: 38,
              minHeight: 36,
            }}
          >
            <span aria-hidden className="flex flex-col gap-[5px]">
              <span style={{ width: 16, height: 2, background: paper.ink }} />
              <span style={{ width: 16, height: 2, background: paper.ink }} />
            </span>
          </motion.button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

// Brutalist full-screen menu for small screens — portaled to <body> (the mode
// wrapper is transformed, so position:fixed would otherwise anchor to it).
// Mirrors ProjectDetail's key handling: Esc / backtick close in capture phase,
// Tab is trapped, focus returns to the hamburger on close.
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "`") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") trapTab(e, panelRef.current);
    };
    window.addEventListener("keydown", onKey, true);
    const id = window.setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.055,
        delayChildren: reduced ? 0 : 0.05,
      },
    },
  };
  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
    : {
        hidden: { opacity: 0, x: -18 },
        show: { opacity: 1, x: 0, transition: { duration: 0.45, ease } },
      };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="paper-mobile-menu"
          ref={panelRef}
          id="paper-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[200] flex flex-col overflow-y-auto"
          style={{ background: paper.bg, color: paper.ink, fontFamily: FB }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.12 : 0.2, ease }}
        >
          <PaperGrain />

          <div
            className="relative z-[2] flex items-center justify-between px-5 h-14 shrink-0"
            style={{ borderBottom: HAIR }}
          >
            <a
              href="#top"
              onClick={onClose}
              aria-label="oussamabenberkane — back to top"
              className="bx-logo flex items-center focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <BrandLogo />
            </a>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close menu"
              className="flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                width: 38,
                height: 38,
                background: paper.bg,
                border: HAIR,
                boxShadow: `3px 3px 0 ${paper.ink}`,
                fontFamily: FM,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <motion.nav
            variants={container}
            initial="hidden"
            animate="show"
            aria-label="Sections"
            className="relative z-[2] flex-1 flex flex-col justify-center"
          >
            {PAPER_NAV.map((n, idx) => (
              <motion.a
                key={n.href}
                variants={item}
                href={n.href}
                onClick={onClose}
                className="flex items-center justify-between gap-4 px-5 py-5 uppercase focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                style={{ borderBottom: HAIR }}
              >
                <span className="flex items-baseline gap-3">
                  <span
                    style={{
                      fontFamily: FM,
                      fontSize: 12,
                      fontWeight: 700,
                      color: paper.accentDk,
                      letterSpacing: "0.06em",
                    }}
                  >
                    ({String(idx + 1).padStart(2, "0")})
                  </span>
                  <span
                    style={{
                      fontFamily: FD,
                      fontWeight: 800,
                      letterSpacing: "-0.025em",
                      lineHeight: 0.95,
                      fontSize: "clamp(1.8rem, 8vw, 2.6rem)",
                    }}
                  >
                    {n.label}
                  </span>
                </span>
                <span aria-hidden style={{ fontFamily: FM, fontSize: 18, color: paper.inkSoft }}>
                  →
                </span>
              </motion.a>
            ))}
          </motion.nav>

          <div
            className="relative z-[2] flex flex-col gap-5 px-5 py-6 shrink-0"
            style={{ borderTop: HAIR }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <CvButton tone="light" />
              <Pill href={`mailto:${profile.email}`} label="Let's talk" />
            </div>
            <div
              className="flex flex-wrap gap-x-5 gap-y-2"
              style={{
                fontFamily: FM,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 600,
              }}
            >
              {profile.social.map((s) => {
                const external = s.href.startsWith("http");
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className="bx-link"
                  >
                    {s.label}
                  </a>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

// ─────────────────────────────── hero ──────────────────────────

// Hero centerpiece. At rest it's a grayscale ILLUSTRATION of Ouss (the
// "designed" self). On reveal — hover (fine pointer) or tap (touch) — the
// REAL photo crossfades in and blooms into colour while a green scanline
// sweeps the frame, echoing the paper↔terminal mode transition: the drawn
// self comes to life. Staying monochrome at rest keeps the brutalist-mono
// palette intact; colour is reserved for the transient reveal only.
function Portrait() {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [canHover, setCanHover] = useState(true); // desktop-first SSR default
  const [touched, setTouched] = useState(false); // hide the tap hint after first tap
  const [sweep, setSweep] = useState(0); // bump to replay the scanline

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const apply = (next: boolean) => {
    setRevealed(next);
    setSweep((s) => s + 1);
  };

  // Desktop (fine pointer): hover / keyboard focus reveals, leaving restores.
  // Touch: a deliberate tap toggles between the two selves.
  const interaction = canHover
    ? {
        onMouseEnter: () => apply(true),
        onMouseLeave: () => apply(false),
        onFocus: () => apply(true),
        onBlur: () => apply(false),
        tabIndex: 0,
        "aria-label": `Portrait of ${profile.name} — focus to reveal the photo`,
      }
    : {
        onClick: () => {
          setTouched(true);
          apply(!revealed);
        },
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setTouched(true);
            apply(!revealed);
          }
        },
        role: "button" as const,
        tabIndex: 0,
        "aria-pressed": revealed,
        "aria-label": revealed
          ? `Show the illustration of ${profile.name}`
          : `Show the real photo of ${profile.name}`,
      };

  return (
    <figure
      className="relative w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[380px]"
      style={{ aspectRatio: "4 / 5" }}
    >
      <div
        {...interaction}
        className="relative w-full h-full overflow-hidden select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]"
        style={{
          border: `1.5px solid ${paper.ink}`,
          boxShadow: `8px 8px 0 ${paper.ink}`,
          outlineColor: paper.accent,
          WebkitTapHighlightColor: "transparent",
          cursor: canHover ? undefined : "pointer",
        }}
      >
        {/* base — the illustration, always grayscale */}
        <Image
          src="/ouss.png"
          alt={`Illustration of ${profile.name}`}
          fill
          priority
          sizes="(min-width: 1024px) 33vw, 80vw"
          className="object-cover"
          style={{ filter: "grayscale(1) contrast(1.06)", objectPosition: "center 22%" }}
        />

        {/* reveal — the real photo: crossfades in and blooms from gray to colour */}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.5, ease }}
        >
          <Image
            src="/ouss-animated.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, 80vw"
            className="object-cover"
            style={{
              objectPosition: "center 28%",
              filter: revealed
                ? "grayscale(0) contrast(1.02)"
                : "grayscale(1) contrast(1.06)",
              transition: reduced ? "none" : "filter 0.8s ease",
            }}
          />
        </motion.div>

        {/* green scanline sweep — replays on every reveal / un-reveal */}
        {!reduced && sweep > 0 ? (
          <motion.span
            key={sweep}
            aria-hidden
            className="pointer-events-none absolute inset-x-0"
            initial={{ top: "-4%", opacity: 0.95 }}
            animate={{ top: "104%", opacity: 0 }}
            transition={{ duration: 0.5, ease: "linear" }}
            style={{
              height: 2,
              background: paper.accent,
              boxShadow: `0 0 14px ${paper.accent}, 0 0 4px ${paper.accent}`,
            }}
          />
        ) : null}

        {/* touch-only hint — invites the tap, fades out after first interaction */}
        <AnimatePresence>
          {!canHover && !touched ? (
            <motion.span
              key="tap-hint"
              aria-hidden
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 uppercase"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: reduced ? 0 : [0, -2.5, 0] }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={
                reduced
                  ? { duration: 0.2 }
                  : {
                      opacity: { duration: 0.4 },
                      y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
                    }
              }
              style={{
                background: paper.accent,
                color: paper.onAccent,
                border: `1.5px solid ${paper.ink}`,
                fontFamily: FM,
                fontSize: 9.5,
                letterSpacing: "0.18em",
                fontWeight: 700,
                boxShadow: `2px 2px 0 ${paper.ink}`,
              }}
            >
              Tap <span aria-hidden>→</span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <figcaption
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 whitespace-nowrap uppercase"
        style={{
          background: paper.accent,
          color: paper.onAccent,
          border: `1.5px solid ${paper.ink}`,
          fontFamily: FM,
          fontSize: 10,
          letterSpacing: "0.16em",
          fontWeight: 700,
        }}
      >
        Béjaïa · 2026
      </figcaption>
    </figure>
  );
}

function Hero() {
  const reduced = useReducedMotion();
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.09,
        delayChildren: reduced ? 0 : 0.06,
      },
    },
  };
  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.25 } } }
    : {
        hidden: { opacity: 0, y: 26 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
      };
  const photo = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.25 } } }
    : {
        hidden: { opacity: 0, scale: 1.04, y: 16 },
        show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.9, ease } },
      };

  const heading = {
    fontFamily: FD,
    fontWeight: 800 as const,
    lineHeight: 0.88,
    letterSpacing: "-0.035em",
    fontSize: "clamp(2.1rem, 4.6vw, 3.7rem)",
  };

  return (
    <motion.section
      id="top"
      aria-label="Introduction"
      variants={container}
      initial="hidden"
      animate="show"
      className="relative z-[2] px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 lg:pt-14 pb-8 sm:pb-10 lg:pb-10 lg:min-h-[calc(100svh-3.5rem)] lg:flex lg:flex-col"
    >
      <div className="grid grid-cols-12 items-center gap-y-8 lg:gap-y-0 lg:flex-1 lg:content-center">
        {/* LEFT — name */}
        <motion.div
          variants={item}
          className="col-span-12 lg:col-span-4 order-2 lg:order-1"
        >
          <h1 className="uppercase" style={heading}>
            <span className="block" style={{ whiteSpace: "nowrap" }}>
              Oussama
            </span>
            <span className="block" style={{ whiteSpace: "nowrap" }}>
              Benberkane
            </span>
          </h1>
          <p
            className="mt-4"
            style={{
              fontFamily: FM,
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: paper.inkSoft,
              fontWeight: 600,
              lineHeight: 1.7,
            }}
          >
            AI Graduate
            <br />
            &amp; Software Engineer
          </p>
        </motion.div>

        {/* CENTER — portrait */}
        <motion.div
          variants={photo}
          className="col-span-12 lg:col-span-4 order-1 lg:order-2 flex justify-center"
        >
          <Portrait />
        </motion.div>

        {/* RIGHT — bio + availability + CTA + socials */}
        <motion.div
          variants={item}
          className="col-span-12 lg:col-span-4 order-3 lg:order-3 flex flex-col gap-6 lg:items-end lg:text-right"
        >
          <p className="max-w-[42ch]" style={{ fontSize: 15, lineHeight: 1.6 }}>
            {profile.tagline}
          </p>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {profile.available ? (
              <span
                className="inline-flex items-center gap-2 px-3 py-2 uppercase"
                style={{
                  border: HAIR,
                  fontFamily: FM,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  fontWeight: 600,
                }}
              >
                <span
                  aria-hidden
                  className="rounded-full"
                  style={{ width: 8, height: 8, background: paper.accent, display: "inline-block" }}
                />
                Available for work
              </span>
            ) : null}
            <Pill href={`mailto:${profile.email}`} label="Let's talk" />
          </div>

          <div
            className="flex items-center gap-4 sm:gap-5 flex-wrap lg:justify-end"
            style={{
              fontFamily: FM,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
            }}
          >
            {profile.social.map((s) => {
              const external = s.href.startsWith("http");
              return (
                <a
                  key={s.label}
                  href={s.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className="bx-link"
                  aria-label={s.label}
                >
                  {SOCIAL_ABBR[s.label] ?? s.label}
                </a>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* SCROLL HINT */}
      <motion.div
        variants={item}
        className="mt-8 lg:mt-0 flex items-center justify-between gap-4"
        style={{ borderTop: HAIR, paddingTop: 16 }}
      >
        <span
          style={{
            fontFamily: FM,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            fontWeight: 600,
            color: paper.inkSoft,
          }}
        >
          {profile.location ?? profile.name}
        </span>
        <a
          href="#works"
          className="bx-link hidden sm:flex items-center gap-2"
          style={{
            fontFamily: FM,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            fontWeight: 600,
            color: paper.inkSoft,
          }}
        >
          <span>Scroll</span>
          <span aria-hidden>↓</span>
        </a>
      </motion.div>
    </motion.section>
  );
}

// ─────────────────────────────── works ─────────────────────────

function Works({
  onOpen,
}: {
  onOpen: (p: (typeof projects)[number]) => void;
}) {
  return (
    <section
      id="works"
      aria-label="Selected work"
      className="relative z-[2] px-5 sm:px-8 lg:px-12 py-14 sm:py-20 lg:py-28"
    >
      <SectionHead num="01" title="Selected Work" kicker={`${projects.length} projects · 2023—2026`} />
      <div className="mt-8 lg:mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-7">
        {projects.map((p, i) => (
          <ProjectCard key={p.title} p={p} i={i} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({
  p,
  i,
  onOpen,
}: {
  p: (typeof projects)[number];
  i: number;
  onOpen: (p: (typeof projects)[number]) => void;
}) {
  const reduced = useReducedMotion();
  // Paper mode allows hover micro-interactions only — clips stay paused (and
  // grayscale, via .bx-card CSS) until the card is hovered or focused.
  const [engaged, setEngaged] = useState(false);
  const num = String(i + 1).padStart(2, "0");
  const featured = !!p.feature;
  // Featured rows alternate the media side for editorial rhythm (poster left,
  // right, left…). DOM order stays media-first so mobile always stacks media on top.
  const flip = featured && i % 2 === 1;

  const media = (
    <div
      className={
        featured
          ? `relative overflow-hidden aspect-[16/9] md:aspect-auto md:w-[44%] md:shrink-0 border-b md:border-b-0 ${
              flip ? "md:border-l" : "md:border-r"
            } border-[color:var(--bx-ink)]`
          : "relative overflow-hidden aspect-[16/9] border-b border-[color:var(--bx-ink)]"
      }
    >
      <ProjectMedia project={p} num={num} hideLabel playing={!reduced && engaged} />
    </div>
  );
  const meta = (
    <div
      className="flex items-center justify-between gap-3"
      style={{ fontFamily: FM, fontSize: 12, fontWeight: 700 }}
    >
      <span style={{ opacity: 0.5 }}>{num}</span>
      <span style={{ color: paper.accentDk }}>{p.year}</span>
    </div>
  );
  const title = (
    <h3
      className="uppercase"
      style={{
        fontFamily: FD,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        lineHeight: 0.95,
        fontSize: featured ? "clamp(1.8rem, 3vw, 2.8rem)" : "clamp(1.35rem, 2vw, 1.75rem)",
      }}
    >
      {p.title}
    </h3>
  );
  const tags = (
    <div className="flex flex-wrap gap-1.5">
      {featured ? <Tag accent>Featured</Tag> : null}
      {p.tags.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </div>
  );
  const blurb = (
    <p
      className={featured ? undefined : "bx-clamp-2"}
      style={{ fontFamily: FB, fontSize: featured ? 14.5 : 13.5, lineHeight: 1.6, color: paper.inkSoft }}
    >
      {p.blurb}
    </p>
  );
  const stackLine = (
    <div
      className="uppercase"
      style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.05em", color: paper.inkSoft, opacity: 0.7 }}
    >
      {p.stack.join("  /  ")}
    </div>
  );
  const footer = (
    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
      <span
        className="uppercase"
        style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.12em", fontWeight: 700 }}
      >
        View case{" "}
        <span aria-hidden className="bx-arrow" style={{ display: "inline-block" }}>
          →
        </span>
      </span>
      {p.metric ? (
        <span style={{ fontFamily: FM, fontSize: 11, color: paper.inkSoft }}>
          {p.metric.value} {p.metric.label}
        </span>
      ) : null}
    </div>
  );

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(p)}
      aria-label={`${p.title} — open case study`}
      aria-haspopup="dialog"
      whileHover={reduced ? undefined : { x: -3, y: -3, boxShadow: `10px 10px 0 ${paper.ink}` }}
      whileTap={reduced ? undefined : { x: 1, y: 1, boxShadow: `4px 4px 0 ${paper.ink}` }}
      onHoverStart={() => setEngaged(true)}
      onHoverEnd={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={`bx-card group flex text-left focus-visible:outline-2 focus-visible:outline-offset-2 ${
        featured
          ? `flex-col md:col-span-2 ${flip ? "md:flex-row-reverse" : "md:flex-row"} md:items-stretch`
          : "flex-col"
      }`}
      style={{
        background: paper.bg,
        border: `1.5px solid ${paper.ink}`,
        boxShadow: `6px 6px 0 ${paper.ink}`,
      }}
    >
      {media}
      <div
        className={`flex flex-1 flex-col ${
          featured ? "gap-3 p-6 sm:p-7" : "gap-3 p-5 sm:p-6"
        }`}
      >
        {meta}
        {title}
        {tags}
        {blurb}
        {stackLine}
        {footer}
      </div>
    </motion.button>
  );
}

// Project media — real clip > screenshot > generated brutalist monogram poster.
// `interactive` gives the <video> controls (detail view); otherwise it sits on
// its first frame until `playing` flips true (card hover/focus), then loops muted.
// `hideLabel` quiets the poster's text (card thumbnails already carry num + stack).
function ProjectMedia({
  project,
  num,
  interactive = false,
  hideLabel = false,
  playing = false,
}: {
  project: (typeof projects)[number];
  num: string;
  interactive?: boolean;
  hideLabel?: boolean;
  playing?: boolean;
}) {
  const clipRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = clipRef.current;
    if (!v || interactive) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, interactive]);

  if (project.video) {
    return (
      <>
        <video
          ref={clipRef}
          className="bx-card-media absolute inset-0 h-full w-full object-cover"
          src={project.video}
          poster={project.poster}
          preload="metadata"
          muted
          playsInline
          loop={!interactive}
          controls={interactive}
        />
        {interactive ? null : (
          <span
            className="absolute uppercase"
            style={{
              top: 10,
              left: 10,
              zIndex: 1,
              padding: "3px 7px",
              background: paper.bg,
              border: `1.5px solid ${paper.ink}`,
              fontFamily: FM,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: paper.ink,
            }}
          >
            ▶ clip
          </span>
        )}
      </>
    );
  }
  if (project.image) {
    return (
      <div className="bx-card-media absolute inset-0">
        <Image
          src={project.image}
          alt={`${project.title} screenshot`}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <GeneratedPoster project={project} num={num} hideLabel={interactive || hideLabel} />
  );
}

// Generated brutalist poster — ink tile, diagonal hatch, accent mark, big monogram.
// Sizes itself to its container via container-query units (cqmin), so the same
// component reads well as a small card thumbnail and as the large detail hero.
function GeneratedPoster({
  project,
  num,
  hideLabel = false,
}: {
  project: (typeof projects)[number];
  num: string;
  hideLabel?: boolean;
}) {
  return (
    <div
      className="bx-card-media absolute inset-0 overflow-hidden"
      style={{ background: paper.ink, containerType: "size" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, transparent 0 13px, ${paperA(
            0.05
          )} 13px 14px)`,
        }}
      />
      <span
        aria-hidden
        className="absolute"
        style={{ top: 14, left: 14, width: 13, height: 13, background: paper.accent }}
      />
      {hideLabel ? null : (
        <span
          className="absolute uppercase"
          style={{
            top: 13,
            right: 14,
            fontFamily: FM,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: paperA(0.55),
          }}
        >
          case · {num}
        </span>
      )}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span
          style={{
            fontFamily: FD,
            fontWeight: 800,
            color: paper.bg,
            lineHeight: 1,
            letterSpacing: "-0.05em",
            fontSize: "36cqmin",
          }}
        >
          {monogram(project.title)}
        </span>
      </span>
      {hideLabel ? null : (
        <span
          className="absolute uppercase truncate"
          style={{
            bottom: 12,
            left: 14,
            right: 14,
            fontFamily: FM,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: paperA(0.55),
          }}
        >
          {project.stack.slice(0, 3).join(" / ")}
        </span>
      )}
    </div>
  );
}

// Project case-study overlay — portaled to <body> so it sits above the transformed,
// overflow-hidden mode wrapper. Locks the paper scroll container while open and
// closes on Esc / backtick / backdrop click.
function ProjectDetail({
  project,
  onClose,
  scrollRef,
}: {
  project: (typeof projects)[number] | null;
  onClose: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const reduced = useReducedMotion();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!project) return;
    const opener = document.activeElement as HTMLElement | null;
    const scroller = scrollRef.current;
    const prevOverflow = scroller?.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    // Intercept in capture phase so the global vim/backtick handler never fires.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "`") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") trapTab(e, dialogRef.current);
    };
    window.addEventListener("keydown", onKey, true);
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
      if (scroller) scroller.style.overflow = prevOverflow ?? "";
      opener?.focus?.();
    };
  }, [project, onClose, scrollRef]);

  // SSR guard — `document` is undefined on the server; on the client the portal is
  // always mounted (empty when closed) so AnimatePresence can animate the exit.
  if (typeof document === "undefined") return null;
  const p = project;
  const num = p ? String(projects.indexOf(p) + 1).padStart(2, "0") : "";

  return createPortal(
    <AnimatePresence>
      {p ? (
        <motion.div
          key="project-overlay"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(8, 8, 6, 0.55)", backdropFilter: "blur(3px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.12 : 0.25, ease }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${p.title} — case study`}
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col overflow-hidden"
            style={{
              width: "min(940px, 94vw)",
              maxHeight: "90dvh",
              background: paper.bg,
              color: paper.ink,
              border: `1.5px solid ${paper.ink}`,
              boxShadow: `10px 10px 0 ${paper.ink}`,
            }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
            transition={{ duration: reduced ? 0.14 : 0.42, ease }}
          >
            <button
              ref={closeBtnRef}
              onClick={onClose}
              aria-label="Close case study"
              className="absolute z-10 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                top: 12,
                right: 12,
                width: 38,
                height: 38,
                background: paper.bg,
                border: `1.5px solid ${paper.ink}`,
                boxShadow: `3px 3px 0 ${paper.ink}`,
                fontFamily: FM,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ✕
            </button>

            <div
              className="relative w-full shrink-0 overflow-hidden"
              style={{ aspectRatio: "16 / 9", borderBottom: `1.5px solid ${paper.ink}` }}
            >
              <ProjectMedia project={p} num={num} interactive />
            </div>

            <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
              <div className="flex flex-col gap-5 p-6 sm:p-8">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h2
                    className="uppercase"
                    style={{
                      fontFamily: FD,
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      lineHeight: 0.92,
                      fontSize: "clamp(2rem, 5vw, 3.2rem)",
                    }}
                  >
                    {p.title}
                  </h2>
                  <span
                    style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, color: paper.accentDk }}
                  >
                    {p.year}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {p.feature ? <Tag accent>Featured</Tag> : null}
                  {p.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>

                {p.metric ? (
                  <div
                    className="inline-flex items-baseline gap-2 self-start px-3 py-2"
                    style={{ border: HAIR }}
                  >
                    <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 20 }}>
                      {p.metric.value}
                    </span>
                    <span
                      className="uppercase"
                      style={{
                        fontFamily: FM,
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        color: paper.inkSoft,
                      }}
                    >
                      {p.metric.label}
                    </span>
                  </div>
                ) : null}

                <p style={{ fontFamily: FB, fontSize: 15.5, lineHeight: 1.65, maxWidth: "64ch" }}>
                  {p.blurb}
                </p>

                <div>
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: FM,
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      color: paper.inkSoft,
                      fontWeight: 700,
                    }}
                  >
                    Stack
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.stack.map((s) => (
                      <Tag key={s}>{s}</Tag>
                    ))}
                  </div>
                </div>

                {p.href || p.demo ? (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {p.href ? <Pill href={p.href} label="Visit live" /> : null}
                    {p.demo ? <DetailLink href={p.demo} label="Demo" /> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

// Secondary (outline) CTA used alongside the accent Pill in the detail view.
function DetailLink({ href, label }: { href: string; label: string }) {
  const reduced = useReducedMotion();
  const external = href.startsWith("http");
  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      whileHover={reduced ? undefined : { x: -2, y: -2 }}
      whileTap={reduced ? undefined : { x: 1, y: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="inline-flex items-center gap-2 px-4 py-2.5 uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: paper.bg,
        color: paper.ink,
        border: `1.5px solid ${paper.ink}`,
        boxShadow: `4px 4px 0 ${paper.ink}`,
        fontFamily: FM,
        fontSize: 12,
        letterSpacing: "0.12em",
        fontWeight: 700,
      }}
    >
      {label}
      <span aria-hidden>↗</span>
    </motion.a>
  );
}

// ──────────────────────────── experience ───────────────────────

function Exp() {
  return (
    <section
      id="experience"
      aria-label="Experience"
      className="relative z-[2] px-5 sm:px-8 lg:px-12 py-14 sm:py-20 lg:py-28"
      style={{ background: paper.panel, borderTop: HAIR, borderBottom: HAIR }}
    >
      <SectionHead num="02" title="Experience" kicker={`${experience.length} roles · since 2023`} />
      {/* Default grid stretch keeps cards in a row equal height; ExpCard's mt-auto
          tag row pins to the bottom so the stretched space reads as intentional. */}
      <div className="mt-8 lg:mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {experience.map((e) => (
          <ExpCard key={`${e.company}-${e.start}`} e={e} />
        ))}
      </div>
    </section>
  );
}

function ExpCard({ e }: { e: (typeof experience)[number] }) {
  const reduced = useReducedMotion();
  const current = e.end.trim().toLowerCase() === "present";
  return (
    <motion.article
      whileHover={reduced ? undefined : { x: -3, y: -3, boxShadow: `10px 10px 0 ${paper.ink}` }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="bx-card flex flex-col gap-4 p-6 sm:p-7"
      style={{
        background: paper.bg,
        border: `1.5px solid ${paper.ink}`,
        boxShadow: `6px 6px 0 ${paper.ink}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className="uppercase"
            style={{
              fontFamily: FD,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 0.95,
              fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
            }}
          >
            {e.company}
          </h3>
          <div
            className="mt-1 uppercase"
            style={{
              fontFamily: FM,
              fontSize: 12,
              letterSpacing: "0.08em",
              color: paper.accentDk,
              fontWeight: 600,
            }}
          >
            {e.role}
          </div>
        </div>
        {current ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 uppercase"
            style={{
              background: paper.accent,
              color: paper.onAccent,
              border: `1.5px solid ${paper.ink}`,
              fontFamily: FM,
              fontSize: 10,
              letterSpacing: "0.12em",
              fontWeight: 700,
            }}
          >
            <span
              aria-hidden
              className="rounded-full"
              style={{ width: 6, height: 6, background: paper.onAccent, display: "inline-block" }}
            />
            Now
          </span>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
        style={{ fontFamily: FM, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }}
      >
        <span>
          {e.start} — {e.end}
        </span>
        <span aria-hidden style={{ opacity: 0.4 }}>
          /
        </span>
        <span style={{ color: paper.inkSoft, fontWeight: 600 }}>{e.location}</span>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6 }}>{e.summary}</p>

      <ul className="space-y-1.5">
        {e.highlights.map((h, hi) => (
          <li key={hi} className="flex gap-2" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            <span aria-hidden style={{ color: paper.accentDk, fontFamily: FM }}>
              →
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {e.stack.map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </div>
    </motion.article>
  );
}

// ─────────────────────────────── about ─────────────────────────

function About() {
  return (
    <section
      id="about"
      aria-label="About"
      className="relative z-[2] px-5 sm:px-8 lg:px-12 py-14 sm:py-20 lg:py-28"
    >
      <SectionHead num="03" title="About" kicker="The maker" />
      <div className="mt-8 lg:mt-10 grid grid-cols-12 gap-8 lg:gap-10 items-start">
        <div className="col-span-12 lg:col-span-5">
          <figure className="relative w-full max-w-[420px]" style={{ aspectRatio: "4 / 5" }}>
            <div
              className="relative w-full h-full overflow-hidden"
              style={{ border: `1.5px solid ${paper.ink}`, boxShadow: `8px 8px 0 ${paper.ink}` }}
            >
              <Image
                src="/ouss.png"
                alt={`${profile.name} at work`}
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
                style={{ filter: "grayscale(1) contrast(1.06)", objectPosition: "center 22%" }}
              />
            </div>
          </figure>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <h3
            className="uppercase"
            style={{
              fontFamily: FD,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: "-0.025em",
              fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)",
            }}
          >
            One engineer.
            <br />
            <span style={{ color: paper.accentDk }}>Built to ship.</span>
          </h3>
          <p className="mt-5 max-w-[58ch]" style={{ fontSize: 15.5, lineHeight: 1.65 }}>
            {profile.name} — software engineer based in {profile.location}. {profile.tagline}
          </p>
          <div
            className="mt-8 grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: 1, background: paper.ink, border: `1px solid ${paper.ink}` }}
          >
            {values.map((v) => (
              <div key={v.k} className="p-5 sm:p-6" style={{ background: paper.bg }}>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{ width: 7, height: 7, background: paper.accent, display: "inline-block" }}
                  />
                  <span
                    className="uppercase"
                    style={{ fontFamily: FM, fontSize: 12, letterSpacing: "0.08em", fontWeight: 700 }}
                  >
                    {v.k}
                  </span>
                </div>
                <p className="mt-2" style={{ fontSize: 13.5, lineHeight: 1.55, color: paper.inkSoft }}>
                  {v.v}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────── studies ────────────────────────

function Studies() {
  return (
    <section
      id="studies"
      aria-label="Studies"
      className="relative z-[2] px-5 sm:px-8 lg:px-12 py-14 sm:py-20 lg:py-28"
      style={{ background: paper.panel, borderTop: HAIR }}
    >
      <SectionHead num="04" title="Studies" kicker={education[0].institution} />
      <div
        className="mt-8 lg:mt-10 grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 1, background: paper.ink, border: `1px solid ${paper.ink}` }}
      >
        {education.map((e) => (
          <div key={e.degree} className="p-6 sm:p-7 lg:p-8" style={{ background: paper.panel }}>
            <div
              style={{
                fontFamily: FM,
                fontSize: 12,
                fontWeight: 700,
                color: paper.accentDk,
                letterSpacing: "0.04em",
              }}
            >
              {e.start} — {e.end}
            </div>
            <h3
              className="mt-2 uppercase"
              style={{
                fontFamily: FD,
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
                fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
              }}
            >
              {e.degree}
            </h3>
            {e.grade ? (
              <div
                className="mt-4 inline-flex items-center gap-2.5 px-3 py-1.5"
                style={{ border: HAIR }}
              >
                <span
                  className="uppercase"
                  style={{
                    fontFamily: FM,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: paper.inkSoft,
                    fontWeight: 600,
                  }}
                >
                  Graduation
                </span>
                <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 16 }}>{e.grade}</span>
              </div>
            ) : null}
            {e.thesis ? (
              <div className="mt-4">
                <div
                  className="uppercase"
                  style={{
                    fontFamily: FM,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: paper.accentDk,
                    fontWeight: 700,
                  }}
                >
                  Thesis
                </div>
                <p
                  className="mt-1 max-w-[48ch]"
                  style={{ fontSize: 13.5, lineHeight: 1.55, color: paper.inkSoft }}
                >
                  {e.thesis}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────── contact ────────────────────────

function Contact() {
  return (
    <section
      id="contact"
      aria-label="Contact"
      className="relative z-[2] px-5 sm:px-8 lg:px-12 py-16 sm:py-24 lg:py-32"
      style={{ background: paper.ink, color: paper.bg }}
    >
      <div
        className="flex items-baseline gap-4"
        style={{ borderBottom: `1px solid ${paper.bg}`, paddingBottom: 14 }}
      >
        <span style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, color: paper.accent }}>
          (05)
        </span>
        <span
          className="uppercase"
          style={{ fontFamily: FM, fontSize: 12, letterSpacing: "0.16em", fontWeight: 600 }}
        >
          Contact
        </span>
      </div>

      <h2
        className="mt-8 uppercase"
        style={{
          fontFamily: FD,
          fontWeight: 800,
          lineHeight: 0.88,
          letterSpacing: "-0.035em",
          fontSize: "clamp(2.4rem, 8vw, 6rem)",
        }}
      >
        {"Let's build"}
        <br />
        something <span style={{ color: paper.accent }}>sharp.</span>
      </h2>

      <div className="mt-10 lg:mt-12 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 md:col-span-7">
          <a
            href={`mailto:${profile.email}`}
            className="bx-link inline-block"
            style={{
              fontFamily: FD,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontSize: "clamp(1.3rem, 3vw, 2.2rem)",
            }}
          >
            {profile.email}
          </a>
          <ul
            className="mt-6 flex flex-wrap gap-x-6 gap-y-2"
            style={{
              fontFamily: FM,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            {profile.social.map((s) => {
              const external = s.href.startsWith("http");
              return (
                <li key={s.label}>
                  <a
                    className="bx-link"
                    href={s.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                  >
                    <span style={{ opacity: 0.55 }}>{s.label}: </span>
                    {s.handle}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="col-span-12 md:col-span-5 md:flex md:justify-end">
          <div className="flex flex-col items-start md:items-end gap-4">
            <span
              className="uppercase"
              style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.14em", opacity: 0.7 }}
            >
              Replies within a day
            </span>
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <Pill href={`mailto:${profile.email}`} label="Write now" shadow={paper.bg} />
              <CvButton tone="dark" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="px-5 sm:px-8 lg:px-12 py-6 lg:py-8"
      style={{ background: paper.ink, color: paper.bg, borderTop: `1px solid ${paper.bg}` }}
    >
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        style={{
          fontFamily: FM,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        <span className="flex items-center gap-3">
          <a
            href="#top"
            aria-label="oussamabenberkane — back to top"
            className="bx-logo flex items-center focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <BrandLogo invert />
          </a>
          {/* quiet portal to the operator console — looks like a plain © mark */}
          <a
            href="/admin"
            aria-label="Admin dashboard"
            className="opacity-55 transition-all hover:opacity-100 hover:text-[#1FBF54] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            © 2026
          </a>
        </span>
        <span style={{ opacity: 0.6 }} className="hidden md:inline">
          Have a peaceful day, and may the odds be ever in your favor.
        </span>
        <span className="flex items-center gap-2">
          Press
          <kbd
            className="px-1.5 py-0.5"
            style={{ background: paper.bg, color: paper.ink, fontWeight: 700 }}
          >
            `
          </kbd>
          for terminal
        </span>
      </div>
    </footer>
  );
}

// ════════════════════════════════════════════════════════════════
// TERMINAL MODE
// ════════════════════════════════════════════════════════════════

function TerminalMode({
  onToggle,
  workspace,
  workspaceDir,
  setWorkspace,
  shellOpen,
  setShellOpen,
  helpOpen,
  setHelpOpen,
}: {
  onToggle: () => void;
  workspace: number;
  workspaceDir: 1 | -1;
  setWorkspace: (n: number) => void;
  shellOpen: boolean;
  setShellOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  const active = workspaces.find((w) => w.n === workspace) ?? workspaces[0];
  const reduced = useReducedMotion();
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main
      className="relative min-h-full"
      style={{
        background: cat.crust,
        color: cat.text,
        fontFamily: "var(--p-mono), ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: "14px",
        lineHeight: 1.6,
      }}
    >
      <DotGrid />

      <div
        className="relative z-10 mx-4 sm:mx-auto max-w-[1100px] mt-6 mb-12 overflow-hidden"
        style={{
          background: cat.base,
          border: `1.5px solid ${cat.surface2}`,
          // dark sibling of paper's hard 8px 8px 0 offset: a faint green hard
          // offset that actually reads on the near-black ground, lifted off the
          // vignette by a soft ambient. Offset (8px) < side margin so it never
          // overflows on a full-width mobile window.
          boxShadow: `8px 8px 0 rgba(31,191,84,0.10), 0 26px 55px -28px #000`,
        }}
      >
        {/* WINDOW CHROME */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: cat.surface1, background: cat.mantle }}
        >
          {/* squared window controls — two outline, one live-green */}
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-[11px] w-[11px]" style={{ border: `1.5px solid ${cat.surface2}` }} />
            <span className="h-[11px] w-[11px]" style={{ border: `1.5px solid ${cat.surface2}` }} />
            <span
              className="h-[11px] w-[11px]"
              style={{ background: cat.green, boxShadow: `0 0 7px ${cat.green}99` }}
            />
          </div>
          <div className="text-[12px] flex items-center" style={{ color: cat.subtext0 }}>
            <span style={{ color: cat.green, fontWeight: 600 }}>ouss</span>
            <span style={{ color: cat.overlay0 }}>@</span>
            <span style={{ color: cat.lavender }}>arch</span>
            <span style={{ color: cat.overlay0 }}>:</span>
            <span style={{ color: cat.lavender }}>{active.cmd}</span>
            <span
              className="term-cursor ml-1"
              aria-hidden
              style={{ width: "0.55ch", height: "0.95em", background: cat.green, transform: "translateY(0.1em)" }}
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px]" style={{ color: cat.overlay1 }}>
            <span
              className="px-1.5 py-0.5 uppercase tracking-[0.12em]"
              style={{ border: `1px solid ${cat.surface1}`, color: cat.subtext0, fontSize: "9.5px" }}
            >
              tmux
            </span>
            <span>portfolio.session</span>
          </div>
        </div>

        {/* WAYBAR */}
        <nav
          aria-label="Workspaces"
          className="flex items-center justify-between px-3 py-1.5 border-b text-[12px]"
          style={{ borderColor: cat.surface0, background: cat.mantle }}
        >
          <div className="flex items-center gap-1 overflow-x-auto">
            {workspaces.map((w) => {
              const isActive = w.n === workspace;
              return (
                <button
                  key={w.slug}
                  onClick={() => setWorkspace(w.n)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`Workspace ${w.n}: ${w.label}`}
                  aria-keyshortcuts={String(w.n)}
                  className="shrink-0 flex items-center gap-2 px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: isActive ? cat.green : "transparent",
                    color: isActive ? cat.crust : cat.subtext0,
                    minHeight: 36,
                    fontWeight: isActive ? 700 : 500,
                    boxShadow: isActive ? `0 0 14px ${cat.green}55` : "none",
                    touchAction: "manipulation",
                  }}
                  title={`Press ${w.n}`}
                >
                  <span
                    className="tabular-nums"
                    aria-hidden
                    style={{ color: isActive ? cat.crust : cat.green, fontWeight: 700 }}
                  >
                    {w.n}
                  </span>
                  <span className="uppercase tracking-[0.08em] text-[11px]">{w.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
              aria-label="Toggle keyboard help"
              aria-expanded={helpOpen}
              aria-keyshortcuts="?"
              title="Press ?"
              style={{
                background: helpOpen ? cat.green : "transparent",
                color: helpOpen ? cat.crust : cat.subtext0,
                border: `1px solid ${helpOpen ? cat.green : cat.surface1}`,
                minHeight: 36,
                fontWeight: 700,
                touchAction: "manipulation",
              }}
            >
              ?
            </button>
            <button
              onClick={() => setShellOpen((v) => !v)}
              className="px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
              aria-label="Toggle shell"
              aria-expanded={shellOpen}
              aria-keyshortcuts="`"
              title="Press ` to toggle"
              style={{
                background: shellOpen ? cat.green : "transparent",
                color: shellOpen ? cat.crust : cat.subtext0,
                border: `1px solid ${shellOpen ? cat.green : cat.surface1}`,
                minHeight: 36,
                fontWeight: 600,
                touchAction: "manipulation",
              }}
            >
              <span aria-hidden style={{ color: shellOpen ? cat.crust : cat.green }}>❯ </span>shell
            </button>
            <motion.button
              onClick={onToggle}
              aria-label="Switch to paper mode"
              aria-keyshortcuts="Escape"
              title="Press Escape"
              whileHover={reduced ? undefined : { x: -1.5, y: -1.5 }}
              whileTap={reduced ? undefined : { x: 1, y: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="inline-flex items-stretch shrink-0 focus-visible:outline-none focus-visible:ring-2"
              style={{
                border: `1.5px solid ${cat.surface2}`,
                boxShadow: `3px 3px 0 #050603`,
                minHeight: 36,
              }}
            >
              <span
                className="flex items-center px-2.5 uppercase"
                style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 700, color: cat.text }}
              >
                paper
              </span>
              <span
                aria-hidden
                className="flex items-center justify-center px-2"
                style={{ background: cat.green, color: cat.crust, fontSize: 11, fontWeight: 700 }}
              >
                Esc
              </span>
            </motion.button>
          </div>
        </nav>

        {/* WORKSPACE BREADCRUMB */}
        <div
          className="flex items-center justify-between px-6 py-3 border-b text-[12px]"
          style={{ borderColor: cat.surface0, background: cat.base }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: cat.green, fontWeight: 700 }}>❯</span>
            <span style={{ color: cat.subtext1 }}>cd</span>
            <span style={{ color: active.tone, fontWeight: 600 }}>{active.cmd}</span>
            <span
              className="term-cursor"
              aria-hidden
              style={{ width: "0.55ch", height: "0.95em", background: cat.green, transform: "translateY(0.1em)" }}
            />
          </div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em]" style={{ color: cat.overlay1 }}>
            <span>ws {String(active.n).padStart(2, "0")} / 06</span>
          </div>
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="relative min-h-[640px] overflow-hidden">
          <AnimatePresence mode="wait" custom={workspaceDir}>
            <motion.div
              key={active.slug}
              custom={workspaceDir}
              variants={{
                enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 28 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: -d * 28 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduced ? 0.18 : 0.28, ease }}
              className="px-6 md:px-10 py-10 md:py-12"
            >
              {active.slug === "home" && <TerminalHome />}
              {active.slug === "work" && <TerminalWork />}
              {active.slug === "career" && <TerminalCareer />}
              {active.slug === "reviews" && <TerminalReviews />}
              {active.slug === "about" && <TerminalAbout />}
              {active.slug === "contact" && <TerminalContact />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* WAYBAR STATUS */}
        <div
          className="flex items-center justify-between px-4 py-1.5 border-t text-[11px]"
          style={{ borderColor: cat.surface0, background: cat.mantle }}
        >
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5"
              style={{ background: active.tone, color: cat.crust, fontWeight: 700 }}
            >
              {profile.location.split(" · ")[0]}
            </span>
            <span style={{ color: cat.overlay1 }}>·</span>
            <span
              className="px-2 py-0.5"
              style={{
                background: shellOpen ? cat.yellow : cat.surface0,
                color: shellOpen ? cat.crust : cat.subtext0,
                fontWeight: 700,
              }}
            >
              {shellOpen ? "COMMAND" : "NORMAL"}
            </span>
            <span className="flex items-center gap-1.5" style={{ color: cat.green }}>
              <span className="term-pulse" aria-hidden>●</span>
              available
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3" style={{ color: cat.overlay1 }}>
            <span>arch · linux 6.14</span>
            <span style={{ color: cat.surface2 }}>·</span>
            <span style={{ color: cat.subtext0 }}>brutalist // mono</span>
            <span style={{ color: cat.surface2 }}>·</span>
            <span style={{ color: cat.lavender }}>{clock}</span>
          </div>
        </div>
      </div>

      <p
        className="mx-auto max-w-[1100px] pb-6 text-center text-[11px]"
        style={{ color: cat.overlay0 }}
      >
        click waybar tabs · press 1–6 / h l · backtick ` for shell · ? for help · esc for paper mode
      </p>

      {/* QUAKE-STYLE DROP-DOWN SHELL */}
      <QuakeShell
        open={shellOpen}
        setOpen={setShellOpen}
        workspace={workspace}
        setWorkspace={setWorkspace}
        onExitToPaper={onToggle}
      />

      {/* HELP OVERLAY */}
      <HelpOverlay open={helpOpen} setOpen={setHelpOpen} />
    </main>
  );
}

function DotGrid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* dot grid */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(${cat.surface0} 1px, transparent 1px)`,
          backgroundSize: "26px 26px",
          backgroundPosition: "-1px -1px",
          opacity: 0.55,
        }}
      />
      {/* faint CRT scanlines, slowly drifting */}
      <div
        className="term-scanlines absolute inset-0"
        style={{
          background: `repeating-linear-gradient(0deg, rgba(31,191,84,0.05) 0 1px, transparent 1px 3px)`,
          opacity: 0.6,
        }}
      />
      {/* vignette — sinks the corners so the window floats */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, transparent 55%, ${cat.crust} 100%)`,
        }}
      />
    </div>
  );
}

// ────── workspace contents ──────

function TerminalHome() {
  return (
    <section className="grid grid-cols-12 gap-x-8 gap-y-8 items-center">
      <div className="col-span-12 md:col-span-7">
        <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.green }}>
          $ whoami
        </div>
        <h1
          className="mt-4 tracking-[-0.02em] leading-[1.05]"
          style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: cat.text }}
        >
          {profile.name}.
        </h1>
        <p className="mt-3 text-[16px]" style={{ color: cat.lavender, fontWeight: 500 }}>
          {profile.role} · {profile.location}
        </p>
        <p className="mt-6 max-w-xl text-[15.5px] leading-[1.7]" style={{ color: cat.subtext1 }}>
          {profile.tagline}
        </p>
        <div className="mt-8 flex flex-wrap gap-3 text-[12.5px]">
          <Hint k="1–6" v="jump workspace" />
          <Hint k="h l" v="prev / next" />
          <Hint k="`" v="open shell" />
          <Hint k="?" v="show help" />
          <Hint k="Esc" v="back to paper" />
        </div>
      </div>
      <div className="col-span-12 md:col-span-5">
        <div className="border p-6" style={{ borderColor: cat.surface0, background: cat.mantle }}>
          <pre
            className="leading-[1.1] whitespace-pre"
            style={{
              fontSize: "12px",
              color: cat.sapphire,
              textShadow: `0 0 10px ${cat.sapphire}40`,
            }}
          >
            {ARCH_LOGO}
          </pre>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 text-[12.5px]">
            <KV k="OS" v="Arch Linux" tone={cat.green} />
            <KV k="Shell" v="zsh" tone={cat.peach} />
            <KV k="Years" v="07+" tone={cat.yellow} />
            <KV k="Projects" v={`${projects.length}+`} tone={cat.maroon} />
            <KV k="Stack" v="Next · TS · Go" tone={cat.mauve} />
            <KV k="Status" v="open" tone={cat.green} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TerminalWork() {
  return (
    <section>
      <Header
        kicker="$ ls -la projects/"
        title="Selected work"
        subtitle={`${projects.length} packages, all shipped, all maintained.`}
        tone={cat.green}
      />
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p, i) => (
          <motion.a
            key={p.title}
            href={p.href ?? "#"}
            target={p.href && p.href !== "#" ? "_blank" : undefined}
            rel={p.href && p.href !== "#" ? "noopener noreferrer" : undefined}
            aria-label={`${p.title} project, opens in new tab`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.04 }}
            className="group border p-5 transition-colors hover:border-current focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: cat.surface0, background: cat.mantle, color: cat.green, touchAction: "manipulation" }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="tracking-[-0.005em]" style={{ fontSize: "1.2rem", fontWeight: 700, color: cat.text }}>
                {p.title.toLowerCase()}
              </h3>
              <span style={{ color: cat.peach, fontSize: "11.5px" }}>{p.year}</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.65]" style={{ color: cat.subtext1 }}>
              {p.blurb}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t" style={{ borderColor: cat.surface0 }}>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em]"
                    style={{ background: cat.surface0, color: cat.sapphire }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              {p.metric ? (
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: cat.overlay1 }}>
                    {p.metric.label}
                  </div>
                  <div className="text-[13px] tabular-nums" style={{ color: cat.green, fontWeight: 600 }}>
                    {p.metric.value}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

function TerminalCareer() {
  return (
    <section>
      <Header
        kicker="$ git log --oneline"
        title="Career history"
        subtitle="Six years across analytics, payments, and logistics platforms."
        tone={cat.green}
      />
      <ol className="mt-10 space-y-8">
        {experience.map((role, i) => (
          <motion.li
            key={role.company}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.05 }}
            className="grid grid-cols-12 gap-x-6 pb-8 border-b"
            style={{ borderColor: cat.surface0 }}
          >
            <div className="col-span-12 md:col-span-3">
              <div className="text-[11px] uppercase tracking-[0.18em] tabular-nums" style={{ color: cat.peach, fontWeight: 600 }}>
                {role.start}–{role.end}
              </div>
              <div className="mt-1 text-[11.5px]" style={{ color: cat.overlay1 }}>
                {role.location.toLowerCase()}
              </div>
            </div>
            <div className="col-span-12 md:col-span-9 mt-3 md:mt-0">
              <h3 className="tracking-[-0.005em]" style={{ fontSize: "1.25rem", fontWeight: 700, color: cat.text }}>
                {role.role}
                <span style={{ color: cat.overlay0 }}> · </span>
                <span style={{ color: cat.lavender, fontWeight: 500 }}>{role.company}</span>
              </h3>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-[1.7]" style={{ color: cat.subtext1 }}>
                {role.summary}
              </p>
              <ul className="mt-3 space-y-1.5">
                {role.highlights.map((h) => (
                  <li key={h} className="flex gap-2.5 text-[14px] leading-[1.6]" style={{ color: cat.text }}>
                    <span style={{ color: cat.green, fontWeight: 700 }}>+</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {role.stack.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em]"
                    style={{ background: cat.surface0, color: cat.subtext0 }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function TerminalReviews() {
  return (
    <section>
      <Header
        kicker="$ cat reviews.md"
        title="What teammates say"
        subtitle="Selected words from people who shipped alongside."
        tone={cat.pink}
      />
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {testimonials.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.05 }}
            className="border p-6"
            style={{ borderColor: cat.surface0, background: cat.mantle }}
          >
            <span
              aria-hidden
              className="block leading-none mb-2"
              style={{ fontSize: "2.5rem", color: cat.pink, fontWeight: 700 }}
            >
              &ldquo;
            </span>
            <blockquote className="text-[15px] leading-[1.65]" style={{ color: cat.text }}>
              {t.quote}
            </blockquote>
            <figcaption className="mt-5 pt-4 border-t text-[11.5px]" style={{ borderColor: cat.surface0, color: cat.subtext0 }}>
              <span style={{ color: cat.text, fontWeight: 600 }}>{t.name}</span>
              <span style={{ color: cat.overlay0 }}> · </span>
              <span>{t.role}</span>
              <span style={{ color: cat.overlay0 }}> · </span>
              <span style={{ color: cat.lavender }}>{t.org}</span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

function TerminalAbout() {
  return (
    <section>
      <Header
        kicker="$ cat about.md"
        title="About"
        subtitle="The shape of the practice and where it was learned."
        tone={cat.mauve}
      />
      <div className="mt-10 grid grid-cols-12 gap-x-8 gap-y-10">
        <div className="col-span-12 md:col-span-7">
          <p className="text-[15.5px] leading-[1.75]" style={{ color: cat.text }}>
            {profile.name} is a software engineer working from {profile.location}.
            He designs and builds performant, opinionated software — from full-stack
            platforms to interfaces engineered for speed and clarity.
          </p>
          <h3 className="mt-10 text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.green }}>
            $ cat principles.txt
          </h3>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {values.map((v) => (
              <li key={v.k} className="border p-4" style={{ borderColor: cat.surface0, background: cat.mantle }}>
                <div className="text-[13px]" style={{ color: cat.green, fontWeight: 700 }}>
                  {v.k}.
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.65]" style={{ color: cat.subtext1 }}>
                  {v.v}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-12 md:col-span-5">
          <h3 className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.green }}>
            $ ls studies/
          </h3>
          <ol className="mt-4 space-y-5">
            {education.map((e) => (
              <li key={e.institution} className="border p-4" style={{ borderColor: cat.surface0, background: cat.mantle }}>
                <div className="text-[11px] uppercase tracking-[0.18em] tabular-nums" style={{ color: cat.peach, fontWeight: 600 }}>
                  {e.start}–{e.end}
                </div>
                <div className="mt-1 text-[14px]" style={{ color: cat.text, fontWeight: 700 }}>
                  {e.institution}
                </div>
                <div className="text-[12.5px]" style={{ color: cat.lavender }}>{e.degree}</div>
                <p className="mt-2 text-[12.5px] leading-[1.65]" style={{ color: cat.subtext0 }}>
                  {e.detail}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function TerminalContact() {
  return (
    <section>
      <Header
        kicker="$ mail --new"
        title="Get in touch"
        subtitle="Brief, specific notes are preferred. Replies usually within a day."
        tone={cat.teal}
      />
      <div className="mt-10 grid grid-cols-12 gap-x-8 gap-y-10 items-end">
        <div className="col-span-12 md:col-span-7">
          <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.peach }}>email</div>
          <a
            href={`mailto:${profile.email}`}
            className="mt-3 inline-block tracking-[-0.005em]"
            style={{
              fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)",
              color: cat.text,
              fontWeight: 700,
              borderBottom: `2px solid ${cat.teal}`,
              paddingBottom: "0.06em",
            }}
          >
            {profile.email}
          </a>
          <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5">
            {profile.social.map((s) => (
              <li key={s.label} className="text-[13.5px]">
                <span style={{ color: cat.peach, fontWeight: 600 }} className="mr-2">
                  {s.label.toLowerCase().padEnd(9, " ")}
                </span>
                <a
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="transition-colors focus-visible:outline-none focus-visible:underline"
                  style={{ color: cat.text }}
                >
                  {s.handle}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-12 md:col-span-5">
          <div className="border p-6" style={{ borderColor: cat.surface0, background: cat.mantle }}>
            <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.teal }}>status</div>
            <div className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
              <KV k="open to" v="senior · staff" tone={cat.green} />
              <KV k="from" v="Q2 2026" tone={cat.peach} />
              <KV k="region" v="EU / remote" tone={cat.mauve} />
              <KV k="reply" v="≤ 1 day" tone={cat.lavender} />
            </div>
            <a
              href={`mailto:${profile.email}`}
              className="mt-6 inline-flex items-center justify-center gap-2 w-full px-5 py-3 text-[13px]"
              style={{ background: cat.teal, color: cat.crust, fontWeight: 700, minHeight: 44 }}
            >
              compose message →
            </a>
            <a
              href={CV_PATH}
              download={CV_FILE}
              className="cv-dl mt-3 inline-flex items-center justify-center gap-2 w-full px-5 py-3 text-[13px]"
              style={{
                border: `1px solid ${cat.surface1}`,
                color: cat.teal,
                fontWeight: 700,
                minHeight: 44,
              }}
            >
              download resume-ouss.pdf <span className="cv-arrow" aria-hidden>↓</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Header({
  kicker,
  title,
  subtitle,
  tone,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  tone: string;
}) {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: tone, fontWeight: 600 }}>
        {kicker}
      </div>
      <h2
        className="mt-3 tracking-[-0.012em]"
        style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", fontWeight: 700, color: cat.text }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-[14.5px]" style={{ color: cat.subtext0 }}>
        {subtitle}
      </p>
    </div>
  );
}

function KV({ k, v, tone }: { k: string; v: string; tone: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span style={{ color: cat.overlay1 }}>{k}</span>
      <span style={{ color: tone, fontWeight: 600 }}>{v}</span>
    </div>
  );
}

function Hint({ k, v }: { k: string; v: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ color: cat.subtext0 }}
    >
      <kbd
        className="px-1.5 py-0.5"
        style={{
          background: cat.surface0,
          color: cat.lavender,
          fontWeight: 700,
          border: `1px solid ${cat.surface1}`,
          fontSize: "11px",
        }}
      >
        {k}
      </kbd>
      <span>{v}</span>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// QUAKE-STYLE DROP-DOWN SHELL
// ════════════════════════════════════════════════════════════════

type ShellLine = {
  text: string;
  kind?: "cmd" | "out" | "err" | "warn" | "info" | "blank" | "head";
  raw?: string;
};

function QuakeShell({
  open,
  setOpen,
  workspace,
  setWorkspace,
  onExitToPaper,
}: {
  open: boolean;
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  workspace: number;
  setWorkspace: (n: number) => void;
  onExitToPaper: () => void;
}) {
  const [input, setInput] = useState("");
  const [out, setOut] = useState<ShellLine[]>([
    { text: "ouss-shell · catppuccin · jetbrains mono", kind: "info" },
    { text: "type 'help' to see commands. Tab to autocomplete. ↑↓ for history. Esc to dismiss.", kind: "info" },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  // focus when opened
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 240);
      return () => clearTimeout(id);
    }
  }, [open]);

  // auto-scroll
  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight, behavior: "smooth" });
  }, [out]);

  const append = useCallback(
    (...lines: ShellLine[]) => setOut((p) => [...p, ...lines]),
    []
  );

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      append({ text: raw, kind: "cmd", raw });
      if (!cmd) return;

      const parts = cmd.split(/\s+/);
      const head = parts[0].toLowerCase();
      const args = parts.slice(1);

      const lines = dispatch(head, args, {
        workspace,
        setWorkspace,
        clear: () => setOut([]),
        close: () => setOpen(false),
        exitToPaper: onExitToPaper,
        history,
      });
      if (lines.length) append(...lines);

      setHistory((h) => [...h, cmd]);
      setHIdx(-1);
    },
    [append, history, workspace, setWorkspace, setOpen, onExitToPaper]
  );

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!history.length) return;
      const next = hIdx + 1;
      if (next >= history.length) {
        setHIdx(-1);
        setInput("");
      } else {
        setHIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const completed = autocomplete(input);
      if (completed.fill) setInput(completed.fill);
      if (completed.list?.length) {
        append({ text: completed.list.join("  "), kind: "info" });
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setOut([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      append({ text: input + "^C", kind: "cmd", raw: input + "^C" });
      setInput("");
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.28, ease }}
          className="fixed inset-x-0 bottom-0 z-[80]"
          style={{
            height: 280,
            background: cat.crust,
            borderTop: `1px solid ${cat.surface1}`,
            boxShadow: `0 -16px 40px -10px rgba(0,0,0,0.6)`,
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b"
            style={{ borderColor: cat.surface0, background: cat.mantle }}
          >
            <div className="flex items-center gap-2 text-[11px]" style={{ color: cat.subtext0 }}>
              <span style={{ color: cat.green, fontWeight: 700 }}>❯</span>
              <span>quake terminal · ouss-shell</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: cat.overlay1 }}>
              <span>esc to dismiss</span>
              <button
                onClick={() => setOpen(false)}
                className="px-2 py-0.5"
                style={{ background: cat.surface0, color: cat.subtext0, minHeight: 24 }}
                aria-label="Close shell"
              >
                ✕
              </button>
            </div>
          </div>
          <div
            onClick={() => inputRef.current?.focus()}
            className="px-4 pt-3 h-[calc(100%-32px)] flex flex-col"
          >
            <div
              ref={outRef}
              role="log"
              aria-live="polite"
              aria-atomic="false"
              aria-label="Shell output"
              className="flex-1 overflow-y-auto pr-1 text-[12.5px] leading-[1.55]"
              style={{
                fontFamily: "var(--p-mono), monospace",
                scrollbarWidth: "thin",
              }}
            >
              {out.map((ln, i) => (
                <ShellLineView key={i} line={ln} />
              ))}
            </div>
            <div className="flex items-baseline gap-2 py-2 border-t" style={{ borderColor: cat.surface0 }}>
              <PowerlinePrompt />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Shell input"
                inputMode="text"
                className="flex-1 bg-transparent outline-none border-none"
                style={{ color: cat.text, fontFamily: "var(--p-mono), monospace", fontSize: "16px" }}
              />
              <BlinkingCursor />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ShellLineView({ line }: { line: ShellLine }) {
  if (line.kind === "cmd") {
    return (
      <div className="flex items-baseline gap-2 mt-1.5">
        <PowerlinePrompt />
        <span style={{ color: cat.text }}>{line.raw ?? line.text}</span>
      </div>
    );
  }
  const color =
    line.kind === "err"
      ? cat.red
      : line.kind === "warn"
      ? cat.yellow
      : line.kind === "info"
      ? cat.sky
      : line.kind === "head"
      ? cat.peach
      : line.kind === "blank"
      ? "transparent"
      : cat.text;
  const weight = line.kind === "head" ? 700 : 400;
  return (
    <div className="whitespace-pre-wrap" style={{ color, fontWeight: weight }}>
      {line.text || " "}
    </div>
  );
}

function PowerlinePrompt() {
  return (
    <span className="select-none whitespace-nowrap text-[12px]" aria-hidden>
      <span className="px-2 py-0.5" style={{ background: cat.green, color: cat.crust, fontWeight: 700 }}>
        ouss
      </span>
      <span className="px-2 py-0.5" style={{ background: cat.surface0, color: cat.lavender }}>
        ~/portfolio
      </span>
      <span style={{ color: cat.mauve, fontWeight: 700 }}> ❯</span>
    </span>
  );
}

function BlinkingCursor() {
  return (
    <span
      aria-hidden
      className="ouss-blink inline-block"
      style={{
        width: "0.6ch",
        height: "1.05em",
        background: cat.green,
        animation: "ouss-dual-blink 1s steps(1) infinite",
      }}
    >
      <style>{`
        @keyframes ouss-dual-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ouss-blink { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// HELP OVERLAY
// ════════════════════════════════════════════════════════════════

function HelpOverlay({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  // Body-scroll lock + restore focus on close
  const triggerRef = useRef<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus first focusable inside the dialog
    const id = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      first?.focus();
    }, 30);
    return () => {
      clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      // return focus to opener
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: "rgba(11,11,15,0.7)", backdropFilter: "blur(4px)" }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-overlay-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-[92vw] max-h-[88vh] overflow-y-auto border p-6"
            style={{
              borderColor: cat.surface1,
              background: cat.base,
              color: cat.text,
              fontFamily: "var(--p-mono), monospace",
              fontSize: "13px",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div id="help-overlay-title" className="flex items-center gap-2">
                <span style={{ color: cat.lavender, fontWeight: 700 }} aria-hidden>?</span>
                <span style={{ color: cat.subtext0 }}>keyboard reference</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close keyboard help"
                className="px-3 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: cat.surface0,
                  color: cat.subtext0,
                  minHeight: 36,
                  touchAction: "manipulation",
                }}
              >
                esc
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <HelpSection title="navigation">
                <HelpRow k="1 — 6" v="jump workspace" />
                <HelpRow k="h" v="prev workspace" />
                <HelpRow k="l" v="next workspace" />
                <HelpRow k="j / k" v="scroll down/up" />
                <HelpRow k="gg" v="scroll to top" />
                <HelpRow k="G" v="scroll to bottom" />
              </HelpSection>
              <HelpSection title="modes &amp; shell">
                <HelpRow k="`" v="open shell · close shell" />
                <HelpRow k=":" v="open shell" />
                <HelpRow k="?" v="toggle this help" />
                <HelpRow k="esc" v="close shell · back to paper" />
                <HelpRow k="Ctrl+L" v="clear shell" />
                <HelpRow k="Ctrl+C" v="abort shell input" />
              </HelpSection>
            </div>
            <div className="mt-5 pt-4 border-t" style={{ borderColor: cat.surface0 }}>
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: cat.peach, fontWeight: 700 }}>
                shell commands
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px]">
                <HelpRow k="ls / ls -la" v="list files" />
                <HelpRow k="cd <ws|file>" v="change workspace" />
                <HelpRow k="cat <file>" v="about · contact · ..." />
                <HelpRow k="pacman -Qe" v="list projects" />
                <HelpRow k="pacman -Si <pkg>" v="project detail" />
                <HelpRow k="git log/status/branch" v="experience" />
                <HelpRow k="man <topic>" v="man page" />
                <HelpRow k="tldr <topic>" v="short example" />
                <HelpRow k="htop" v="one-shot stats" />
                <HelpRow k="neofetch" v="system info" />
                <HelpRow k="whoami / pwd" v="identity" />
                <HelpRow k="which <cmd>" v="binary path" />
                <HelpRow k="echo <text>" v="print text" />
                <HelpRow k="date / uname -a" v="time / kernel" />
                <HelpRow k="history / clear" v="shell history" />
                <HelpRow k=":q / :wq / vim" v="(easter eggs)" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function HelpSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-[11px] uppercase tracking-[0.18em] mb-2"
        style={{ color: cat.peach, fontWeight: 700 }}
      >
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function HelpRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <kbd
        className="px-1.5 py-0.5 text-[11px]"
        style={{
          background: cat.surface0,
          color: cat.lavender,
          fontWeight: 700,
          border: `1px solid ${cat.surface1}`,
        }}
      >
        {k}
      </kbd>
      <span style={{ color: cat.subtext1 }}>{v}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SHELL COMMAND DISPATCH
// ════════════════════════════════════════════════════════════════

const FILES = ["about.md", "contact.md", "principles.md", "projects.md", "resume-ouss.pdf", "reviews.md", "studies.md"];
const COMMANDS = [
  "help", "whoami", "pwd", "ls", "cd", "cat", "echo", "clear", "history", "exit", "date",
  "uname", "which", "neofetch", "fastfetch", "pacman", "git", "man", "tldr", "htop",
  "cv", "resume", "vim", "emacs", "sudo", "rm",
];

function dispatch(
  head: string,
  args: string[],
  ctx: {
    workspace: number;
    setWorkspace: (n: number) => void;
    clear: () => void;
    close: () => void;
    exitToPaper: () => void;
    history: string[];
  }
): ShellLine[] {
  if (head) trackEvent("shell_command", { cmd: head });
  switch (head) {
    case "":
      return [];
    case "help":
      return cmdHelp();
    case "whoami":
      return [{ text: "ouss", kind: "out" }];
    case "pwd":
      return [{ text: `/home/ouss/portfolio/${workspaces[ctx.workspace - 1].slug}`, kind: "out" }];
    case "ls":
      return cmdLs(args);
    case "cd":
      return cmdCd(args, ctx);
    case "cat":
      return cmdCat(args);
    case "echo":
      return [{ text: args.join(" "), kind: "out" }];
    case "clear":
      ctx.clear();
      return [];
    case "history":
      return ctx.history.length
        ? ctx.history.map((h, i) => ({ text: `${String(i + 1).padStart(4, " ")}  ${h}`, kind: "out" as const }))
        : [{ text: "(no history)", kind: "info" }];
    case "exit":
      ctx.close();
      return [{ text: "logout", kind: "info" }];
    case "date":
      return [{ text: new Date().toString(), kind: "out" }];
    case "uname":
      return [{ text: "Linux arch 6.14.2-arch1-1 #1 SMP x86_64 GNU/Linux", kind: "out" }];
    case "which":
      return cmdWhich(args);
    case "neofetch":
    case "fastfetch":
      return cmdNeofetch();
    case "pacman":
      return cmdPacman(args);
    case "git":
      return cmdGit(args);
    case "man":
      return cmdMan(args);
    case "tldr":
      return cmdTldr(args);
    case "htop":
    case "btop":
      return cmdHtop();
    case "mail":
    case "email": {
      if (typeof window !== "undefined") window.location.href = `mailto:${profile.email}`;
      return [{ text: `opening mail client → mailto:${profile.email}`, kind: "info" }];
    }
    case "cv":
    case "resume": {
      if (typeof window !== "undefined") {
        const a = document.createElement("a");
        a.href = CV_PATH;
        a.download = CV_FILE;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return [
        { text: "fetching résumé …", kind: "info" },
        { text: `→ saved ${CV_FILE} to ~/Downloads`, kind: "out" },
      ];
    }
    case "vim":
    case "vi":
      return [
        { text: "no.", kind: "err" },
        { text: "(joke. real vim has no escape — use Esc here to leave the shell.)", kind: "info" },
      ];
    case "emacs":
      return [{ text: "M-x butterfly. operation succeeded.", kind: "info" }];
    case "sudo":
      return [
        { text: "[sudo] password for ouss: ", kind: "warn" },
        { text: "Sorry, try again.", kind: "err" },
        { text: "Sorry, try again.", kind: "err" },
        { text: "sudo: 3 incorrect password attempts", kind: "err" },
      ];
    case "rm":
      if (args[0] === "-rf" && args[1] === "/") {
        return [
          { text: "rm: cannot remove '/': Permission denied", kind: "err" },
          { text: "(nice try.)", kind: "info" },
        ];
      }
      return [{ text: "rm: missing operand or path not found", kind: "err" }];
    case ":q":
    case ":q!":
    case ":wq":
      ctx.close();
      return [{ text: "leaving shell.", kind: "info" }];
    default:
      return [{ text: `command not found: ${head}. type 'help'.`, kind: "err" }];
  }
}

function cmdHelp(): ShellLine[] {
  return [
    { text: "Available commands:", kind: "info" },
    { text: "  navigation:  ls · cd · pwd · cat · which", kind: "out" },
    { text: "  résumé:      cv · resume  (downloads the PDF)", kind: "out" },
    { text: "  system:      whoami · uname · date · echo · clear · history · exit", kind: "out" },
    { text: "  pacman:      pacman -Qe · pacman -Si <pkg>", kind: "out" },
    { text: "  git:         git log · git status · git branch", kind: "out" },
    { text: "  docs:        man <topic> · tldr <topic> · htop · neofetch", kind: "out" },
    { text: "  joke:        vim · emacs · sudo · rm -rf / · :q", kind: "out" },
    { text: "Tab to autocomplete. ↑ ↓ for history. Esc dismisses.", kind: "info" },
  ];
}

function cmdLs(args: string[]): ShellLine[] {
  const long = args.includes("-la") || args.includes("-l");
  if (long) {
    return [
      { text: "total 6", kind: "info" },
      { text: "drwxr-xr-x  2 ouss ouss   4096  apr 26  ws/", kind: "out" },
      ...FILES.map((f) => ({
        text: `-rw-r--r--  1 ouss ouss   ${(f.length * 84) % 4096}  apr 26  ${f}`,
        kind: "out" as const,
      })),
    ];
  }
  return [{ text: `ws/  ${FILES.join("  ")}`, kind: "out" }];
}

function cmdCd(
  args: string[],
  ctx: { setWorkspace: (n: number) => void; workspace: number }
): ShellLine[] {
  const target = args[0]?.toLowerCase();
  if (!target || target === "~" || target === "~/portfolio") {
    return [{ text: "(at portfolio root)", kind: "info" }];
  }
  const ws = workspaces.find(
    (w) => w.slug === target || w.cmd.endsWith(`/${target}`) || `~/${target}` === w.cmd
  );
  if (ws) {
    ctx.setWorkspace(ws.n);
    return [{ text: `→ ${ws.cmd}`, kind: "info" }];
  }
  // try numeric
  const n = Number(target);
  if (n >= 1 && n <= 6) {
    ctx.setWorkspace(n);
    return [{ text: `→ ${workspaces[n - 1].cmd}`, kind: "info" }];
  }
  return [{ text: `cd: no such workspace: ${target}`, kind: "err" }];
}

function cmdCat(args: string[]): ShellLine[] {
  const f = args[0]?.toLowerCase();
  if (!f) return [{ text: "cat: missing operand", kind: "err" }];
  const norm = f.replace(/\.(md|pdf)$/, "");
  switch (norm) {
    case "resume":
    case "cv":
      return [
        { text: "# résumé", kind: "head" },
        { text: "" },
        { text: `${CV_FILE} · PDF · binary`, kind: "out" },
        { text: "run `resume` (or `cv`) to download it.", kind: "info" },
      ];
    case "about":
      return [
        { text: "# whoami", kind: "head" },
        { text: "" },
        { text: profile.tagline, kind: "out" },
        { text: "" },
        { text: "## principles", kind: "head" },
        ...values.flatMap((v) => [
          { text: `- ${v.k.toLowerCase()}: ${v.v}`, kind: "out" as const },
        ]),
      ];
    case "contact":
      return [
        { text: "# contact", kind: "head" },
        { text: "" },
        { text: `email     ${profile.email}`, kind: "out" },
        ...profile.social.map((s) => ({
          text: `${s.label.toLowerCase().padEnd(9)} ${s.handle}`,
          kind: "out" as const,
        })),
      ];
    case "principles":
      return values.flatMap((v) => [
        { text: `## ${v.k.toLowerCase()}`, kind: "head" as const },
        { text: v.v, kind: "out" as const },
        { text: "" },
      ]);
    case "projects":
      return projects.map((p) => ({
        text: `${p.title.toLowerCase().padEnd(18)} ${p.year}  ${p.blurb.split(".")[0]}.`,
        kind: "out" as const,
      }));
    case "reviews":
    case "testimonials":
      return testimonials.flatMap((t, i) => [
        { text: `## review ${String(i + 1).padStart(2, "0")}`, kind: "head" as const },
        { text: `> "${t.quote}"`, kind: "out" as const },
        { text: `> — ${t.name}, ${t.role} @ ${t.org}`, kind: "out" as const },
        { text: "" },
      ]);
    case "studies":
      return education.flatMap((e) => [
        { text: `## ${e.institution.toLowerCase()}`, kind: "head" as const },
        { text: `${e.degree.toLowerCase()} (${e.start}–${e.end})`, kind: "out" as const },
        { text: e.detail, kind: "out" as const },
        { text: "" },
      ]);
    default:
      return [{ text: `cat: ${f}: No such file or directory`, kind: "err" }];
  }
}

function cmdWhich(args: string[]): ShellLine[] {
  const t = args[0]?.toLowerCase();
  if (!t) return [{ text: "which: missing argument", kind: "err" }];
  if (COMMANDS.includes(t)) return [{ text: `/usr/bin/${t}`, kind: "out" }];
  return [{ text: `which: no ${t} in (PATH)`, kind: "err" }];
}

function cmdNeofetch(): ShellLine[] {
  return [
    { text: `       /\\           ouss@arch`, kind: "info" },
    { text: `      /  \\          ─────────`, kind: "out" },
    { text: `     /\\   \\         OS         Arch Linux x86_64`, kind: "out" },
    { text: `    /  \\   \\        Kernel     6.14.2-arch1-1`, kind: "out" },
    { text: `   / /\\ \\   \\       Packages   ${projects.length} (pacman)`, kind: "out" },
    { text: `  / /  \\ \\   \\      Shell      zsh 5.9 (starship)`, kind: "out" },
    { text: ` / /    \\ \\   \\     WM         Hyprland 0.41`, kind: "out" },
    { text: `/_/______\\_\\___\\    Theme      Catppuccin-Mocha-Mauve`, kind: "out" },
    { text: ``, kind: "blank" },
    { text: `                    Memory     ${experience.length} jobs · ${projects.length} projects`, kind: "out" },
    { text: `                    Locale     ${profile.location.toLowerCase()}`, kind: "out" },
  ];
}

function cmdPacman(args: string[]): ShellLine[] {
  const flag = args[0];
  if (flag === "-Qe" || flag === "-Q") {
    return [
      { text: ":: querying explicitly-installed packages...", kind: "info" },
      ...projects.map((p, i) => ({
        text: `${p.title.toLowerCase().padEnd(18)} ${p.year}.${String(i + 1).padStart(2, "0")}-1  ${p.blurb.split(".")[0]}.`,
        kind: "out" as const,
      })),
      { text: `:: ${projects.length} packages installed (explicit) · 0 orphaned`, kind: "info" },
    ];
  }
  if (flag === "-Si" || flag === "-Qi") {
    const target = args[1]?.toLowerCase();
    const p = projects.find(
      (x) =>
        x.title.toLowerCase() === target ||
        x.title.toLowerCase().replace(/\s+/g, "-") === target
    );
    if (!p) return [{ text: `error: package '${target}' was not found`, kind: "err" }];
    return [
      { text: `Repository      : community`, kind: "out" },
      { text: `Name            : ${p.title.toLowerCase().replace(/\s+/g, "-")}`, kind: "out" },
      { text: `Version         : ${p.year}.x-1`, kind: "out" },
      { text: `Description     : ${p.blurb}`, kind: "out" },
      { text: `Tags            : ${p.tags.join(", ")}`, kind: "out" },
      ...(p.metric
        ? [{ text: `${p.metric.label.padEnd(16)}: ${p.metric.value}`, kind: "out" as const }]
        : []),
      { text: `Maintainer      : ${profile.handle.replace("@", "")}`, kind: "out" },
    ];
  }
  return [{ text: "usage: pacman -Qe | -Si <package>", kind: "warn" }];
}

function cmdGit(args: string[]): ShellLine[] {
  const sub = args[0];
  if (sub === "log") {
    return experience.flatMap((role, i) => [
      {
        text: `* ${i === 0 ? "(HEAD -> main, origin/main) " : ""}${shortHash(role.company)} — ${role.role.toLowerCase()} @ ${role.company.toLowerCase()}`,
        kind: "out" as const,
      },
      { text: `  Author: ${profile.name} <${profile.email}>`, kind: "info" as const },
      { text: `  Date:   ${role.start}–${role.end} (${role.location})`, kind: "info" as const },
      { text: "" },
    ]);
  }
  if (sub === "status") {
    return [
      { text: "On branch main", kind: "out" },
      { text: "Your branch is up to date with 'origin/main'.", kind: "info" },
      { text: "", kind: "blank" },
      { text: "nothing to commit, working tree clean", kind: "info" },
    ];
  }
  if (sub === "branch") {
    return [
      { text: "* main", kind: "out" },
      { text: "  experience", kind: "out" },
      { text: "  projects", kind: "out" },
      { text: "  open-source", kind: "out" },
    ];
  }
  return [{ text: "usage: git log | status | branch", kind: "warn" }];
}

function cmdMan(args: string[]): ShellLine[] {
  const t = args[0]?.toLowerCase();
  if (!t) return [{ text: "What manual page do you want?", kind: "err" }];

  // try project
  const p = projects.find(
    (x) =>
      x.title.toLowerCase() === t ||
      x.title.toLowerCase().replace(/\s+/g, "-") === t
  );
  if (p) {
    return [
      { text: `${p.title.toUpperCase()}(7)               Engineer's Manual               ${p.title.toUpperCase()}(7)`, kind: "info" },
      { text: "" },
      { text: "NAME", kind: "head" },
      { text: `       ${p.title.toLowerCase()} - ${p.blurb.split(".")[0].toLowerCase()}`, kind: "out" },
      { text: "" },
      { text: "DESCRIPTION", kind: "head" },
      { text: `       ${p.blurb}`, kind: "out" },
      { text: "" },
      { text: "TAGS", kind: "head" },
      { text: `       ${p.tags.join(", ")}`, kind: "out" },
      { text: "" },
      { text: "YEAR", kind: "head" },
      { text: `       ${p.year}`, kind: "out" },
      ...(p.metric
        ? [
            { text: "" },
            { text: "METRIC", kind: "head" as const },
            { text: `       ${p.metric.label}: ${p.metric.value}`, kind: "out" as const },
          ]
        : []),
    ];
  }
  // try education
  const e = education.find((x) =>
    x.institution.toLowerCase().includes(t) ||
    x.degree.toLowerCase().includes(t)
  );
  if (e) {
    return [
      { text: `${e.institution.toUpperCase()}(7)                Studies                ${e.institution.toUpperCase()}(7)`, kind: "info" },
      { text: "" },
      { text: "NAME", kind: "head" },
      { text: `       ${e.institution.toLowerCase()} - ${e.degree.toLowerCase()}`, kind: "out" },
      { text: "" },
      { text: "PERIOD", kind: "head" },
      { text: `       ${e.start}–${e.end}`, kind: "out" },
      { text: "" },
      { text: "DETAIL", kind: "head" },
      { text: `       ${e.detail}`, kind: "out" },
    ];
  }
  return [{ text: `No manual entry for ${t}`, kind: "err" }];
}

function cmdTldr(args: string[]): ShellLine[] {
  const t = args[0]?.toLowerCase();
  if (!t) return [{ text: "tldr: missing topic", kind: "err" }];
  const p = projects.find(
    (x) =>
      x.title.toLowerCase() === t ||
      x.title.toLowerCase().replace(/\s+/g, "-") === t
  );
  if (p) {
    return [
      { text: `# ${p.title.toLowerCase()}`, kind: "head" },
      { text: "" },
      { text: `> ${p.blurb}`, kind: "info" },
      { text: "" },
      { text: "- summary:", kind: "out" },
      { text: `  ${p.tags.join(", ")} · ${p.year}`, kind: "out" },
      ...(p.metric
        ? [
            { text: "" },
            { text: "- metric:", kind: "out" as const },
            { text: `  ${p.metric.label} = ${p.metric.value}`, kind: "out" as const },
          ]
        : []),
    ];
  }
  return [{ text: `tldr: no page for ${t}. try a project name (helix, atlas, ...)`, kind: "err" }];
}

function cmdHtop(): ShellLine[] {
  return [
    { text: "  PID USER     COMMAND                     CPU%  MEM%  TIME", kind: "info" },
    { text: " 1234 ouss     ouss --portfolio            23.4  18.2  02:14:08", kind: "out" },
    { text: " 1338 ouss     hyprland --workspace=2      08.1  04.6  00:42:19", kind: "out" },
    { text: " 1402 ouss     starship --shell=zsh        00.3  00.8  00:00:54", kind: "out" },
    { text: " 1455 ouss     ❤ coffee                    99.9  ----  ----:----", kind: "out" },
    { text: "", kind: "blank" },
    { text: "[CPU] █████████████░░░░░░░  47%   shipped this quarter", kind: "out" },
    { text: "[MEM] ███████░░░░░░░░░░░░░  38%   working memory", kind: "out" },
    { text: "[NET] ▁▂▄▆█▇▅▃▂▁              steady throughput", kind: "out" },
    { text: "[★]   █████████████████░░░  4.1k  open-source stars", kind: "out" },
  ];
}

// ────── autocomplete

function autocomplete(input: string): { fill?: string; list?: string[] } {
  const parts = input.split(/\s+/);
  if (parts.length === 1) {
    const matches = COMMANDS.filter((c) => c.startsWith(parts[0]));
    if (matches.length === 1) return { fill: matches[0] + " " };
    if (matches.length > 1) return { list: matches };
    return {};
  }
  const head = parts[0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();
  const before = parts.slice(0, -1).join(" ");
  let pool: string[] = [];
  if (head === "cd") {
    pool = workspaces.map((w) => w.slug);
  } else if (head === "cat") {
    pool = FILES;
  } else if (head === "pacman") {
    if (last.startsWith("-")) pool = ["-Qe", "-Si", "-Qi"];
    else pool = projects.map((p) => p.title.toLowerCase().replace(/\s+/g, "-"));
  } else if (head === "man" || head === "tldr") {
    pool = projects.map((p) => p.title.toLowerCase());
  } else if (head === "which") {
    pool = COMMANDS;
  } else if (head === "git") {
    pool = ["log", "status", "branch"];
  }
  const matches = pool.filter((s) => s.startsWith(last));
  if (matches.length === 1) return { fill: `${before} ${matches[0]} ` };
  if (matches.length > 1) return { list: matches };
  return {};
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function formatClock(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function shortHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).slice(0, 7).padEnd(7, "0");
}

