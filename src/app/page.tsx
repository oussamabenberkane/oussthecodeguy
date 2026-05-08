"use client";

import {
  Bricolage_Grotesque,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  profile,
  projects,
  experience,
  testimonials,
  education,
  values,
} from "@/lib/portfolio";

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

// Paper mode — riso × bauhaus
const paper = {
  paper: "#F4EDD8",
  paperSoft: "#EDE4C8",
  paperWarm: "#F8F1DD",
  ink: "#1A1A18",
  red: "#E63946",
  navy: "#1D3557",
  mustard: "#F4A261",
  orange: "#FF5C39",
  bone: "#E8DFB9",
};

// Terminal mode — Catppuccin Mocha
const cat = {
  base: "#1E1E2E",
  mantle: "#181825",
  crust: "#11111B",
  surface0: "#313244",
  surface1: "#45475A",
  surface2: "#585B70",
  text: "#CDD6F4",
  subtext1: "#BAC2DE",
  subtext0: "#A6ADC8",
  overlay1: "#7F849C",
  overlay0: "#6C7086",
  blue: "#89B4FA",
  lavender: "#B4BEFE",
  sapphire: "#74C7EC",
  sky: "#89DCEB",
  teal: "#94E2D5",
  green: "#A6E3A1",
  yellow: "#F9E2AF",
  peach: "#FAB387",
  maroon: "#EBA0AC",
  red: "#F38BA8",
  pink: "#F5C2E7",
  mauve: "#CBA6F7",
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

const workspaces: WS[] = [
  { n: 1, slug: "home", label: "Home", cmd: "~/home", tone: cat.blue },
  { n: 2, slug: "work", label: "Work", cmd: "~/projects", tone: cat.green },
  { n: 3, slug: "career", label: "Career", cmd: "~/experience", tone: cat.peach },
  { n: 4, slug: "reviews", label: "Reviews", cmd: "~/reviews", tone: cat.pink },
  { n: 5, slug: "about", label: "About", cmd: "~/about", tone: cat.mauve },
  { n: 6, slug: "contact", label: "Contact", cmd: "~/contact", tone: cat.teal },
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

export default function DualPreview() {
  const reduced = useReducedMotion() ?? false;
  const [mode, setMode] = useState<Mode>("paper");
  const [transitioning, setTransitioning] = useState<Direction>(null);
  const [hydrated, setHydrated] = useState(false);

  // restore mode from localStorage (after mount, no hydration mismatch)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ouss-portfolio-dual-mode");
      if (saved === "terminal" || saved === "paper") setMode(saved);
    } catch {}
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("ouss-portfolio-dual-mode", mode);
    } catch {}
  }, [mode, hydrated]);

  // mode switch with orchestrated transition
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode || transitioning) return;
      const dir: Direction = next === "terminal" ? "to-terminal" : "to-paper";
      setTransitioning(dir);
      // The actual mode flip happens after the boot-line + flash midpoint.
      const flipDelay = reduced ? 90 : 175;
      const totalDelay = reduced ? 200 : 720;
      window.setTimeout(() => setMode(next), flipDelay);
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
      return next;
    });
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
        background: mode === "paper" ? paper.paper : cat.crust,
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
          aria-hidden={mode !== "paper"}
          initial={false}
          animate={{ x: mode === "paper" ? 0 : "-100%" }}
          transition={
            reduced
              ? { duration: 0.18, ease }
              : { duration: 0.55, ease, delay: mode === "paper" ? 0.18 : 0 }
          }
          className="absolute inset-0 overflow-y-auto"
          style={{ pointerEvents: mode === "paper" ? "auto" : "none" }}
        >
          <PaperMode onToggle={toggleMode} />
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
                  : paper.mustard,
              mixBlendMode: "soft-light",
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// PAPER MODE
// ════════════════════════════════════════════════════════════════

function PaperMode({ onToggle }: { onToggle: () => void }) {
  return (
    <main
      className="relative min-h-full"
      style={{
        background: paper.paper,
        color: paper.ink,
        fontFamily: "var(--p-body), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <PaperGrain />
      <PaperToggle onToggle={onToggle} />
      <PaperHero />
      <PaperRunningBar />
      <PaperProjects />
      <PaperExperience />
      <PaperTestimonials />
      <PaperAboutAcademic />
      <PaperContact />
      <PaperColophon />
    </main>
  );
}

function PaperGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{
        opacity: 0.22,
        mixBlendMode: "multiply",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")",
      }}
    />
  );
}

function PaperToggle({ onToggle }: { onToggle: () => void }) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      onClick={onToggle}
      aria-label="Switch to terminal mode"
      aria-keyshortcuts="`"
      title="Press ` (backtick) to switch"
      whileHover={reduced ? undefined : { x: -1.5, y: -1.5 }}
      whileTap={reduced ? undefined : { x: 1, y: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="fixed top-3 right-3 sm:top-6 sm:right-6 z-40 inline-flex items-stretch focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: paper.paper,
        color: paper.ink,
        border: `1.5px solid ${paper.ink}`,
        fontFamily: "var(--p-mono), ui-monospace, monospace",
        fontSize: "10.5px",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        fontWeight: 700,
        minHeight: 40,
        boxShadow: `3px 3px 0 ${paper.red}`,
        touchAction: "manipulation",
        outlineColor: paper.ink,
      }}
    >
      {/* play indicator */}
      <span
        aria-hidden
        className="flex items-center justify-center px-2.5"
        style={{
          background: paper.red,
          color: paper.paper,
          borderRight: `1.5px solid ${paper.ink}`,
          minWidth: 32,
        }}
      >
        <motion.span
          animate={reduced ? undefined : { x: [0, 2, 0] }}
          transition={
            reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ fontSize: "11px", lineHeight: 1, fontWeight: 800 }}
        >
          ▶
        </motion.span>
      </span>

      {/* label */}
      <span className="flex items-center px-3 sm:px-3.5">
        <span className="hidden sm:inline">terminal mode</span>
        <span className="sm:hidden">terminal</span>
      </span>

      {/* kbd hint */}
      <span
        aria-hidden
        className="hidden sm:flex items-center justify-center px-2.5"
        style={{
          background: paper.ink,
          color: paper.paper,
          fontSize: "12px",
          fontWeight: 800,
          letterSpacing: 0,
          minWidth: 30,
        }}
      >
        `
      </span>
    </motion.button>
  );
}

function GeometricOrnaments() {
  return (
    <>
      {/* red circle — riso-textured + multiply-blended over paper */}
      <motion.div
        aria-hidden
        initial={{ scale: 0, rotate: -45, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease, delay: 0.15 }}
        className="absolute z-[2] pointer-events-none overflow-hidden"
        style={{
          top: "-10vw",
          right: "-10vw",
          width: "44vw",
          height: "44vw",
          borderRadius: "9999px",
          background: paper.red,
          mixBlendMode: "multiply",
        }}
      >
        <RisoTexture color={paper.ink} />
      </motion.div>

      {/* navy square — multiply blends with red where they overlap → maroon overprint */}
      <motion.div
        aria-hidden
        initial={{ x: -160, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1.0, ease, delay: 0.3 }}
        className="absolute z-[2] pointer-events-none overflow-hidden"
        style={{
          top: "44%",
          left: 0,
          width: "20vw",
          height: "20vw",
          background: paper.navy,
          mixBlendMode: "multiply",
        }}
      >
        <RisoTexture color={paper.orange} opacity={0.16} />
      </motion.div>

      {/* mustard triangle — second-pass two-ink overlap with red bleed */}
      <motion.div
        aria-hidden
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease, delay: 0.45 }}
        className="absolute z-[2] pointer-events-none"
        style={{
          bottom: "-6vw",
          left: "42%",
          width: "22vw",
          mixBlendMode: "multiply",
        }}
      >
        <svg viewBox="0 0 200 173" className="block w-full h-auto" aria-hidden>
          <polygon points="100,0 200,173 0,173" fill={paper.mustard} />
        </svg>
      </motion.div>

      {/* halftone radial scatter in lower-right — riso ink fade */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease, delay: 0.55 }}
        className="absolute z-[2] pointer-events-none"
        style={{
          right: "6vw",
          bottom: "10vh",
          width: "24vw",
          height: "24vw",
        }}
      >
        <HalftoneRadial color={paper.orange} cx={0.3} cy={0.7} intensity={1.1} />
      </motion.div>
    </>
  );
}

function PaperHero() {
  const reduced = useReducedMotion();
  const city = profile.location.split("·")[0].trim().toLowerCase();

  return (
    <section
      aria-label="Introduction"
      className="relative z-[3] flex flex-col px-5 sm:px-8 lg:px-16 pt-6 sm:pt-10 pb-10 sm:pb-14 overflow-hidden"
    >
      <GeometricOrnaments />

      {/* ── MASTHEAD ─────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.2 : 0.55, ease }}
        className="relative z-10 border-b-[3px] pb-3"
        style={{ borderColor: paper.ink }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
          style={{
            fontFamily: "var(--p-mono), ui-monospace, monospace",
            fontSize: "10px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: paper.navy }}>Issue №09 · Two-Ink Portfolio</span>
          <span className="hidden sm:inline" style={{ color: paper.ink }}>
            printed in casablanca · MMXXVI
          </span>
          <span style={{ color: paper.red }}>05 / 2026</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-x-6 gap-y-2 flex-wrap">
          <h2
            className="font-[family-name:var(--p-display)] tracking-[-0.045em] uppercase leading-[0.86]"
            style={{
              fontSize: "clamp(1.9rem, 6.2vw, 4.4rem)",
              color: paper.navy,
              fontWeight: 800,
              textShadow: `2.4px 1.6px 0 ${paper.orange}`,
            }}
          >
            OUSS
            <span style={{ color: paper.orange, textShadow: `-2px -1.2px 0 ${paper.navy}` }}>·</span>
            ZINE
          </h2>
          <div
            className="text-right hidden sm:block"
            style={{
              fontFamily: "var(--p-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: paper.ink,
              fontWeight: 600,
              lineHeight: 1.55,
            }}
          >
            <div>printed two colours</div>
            <div>cadmium · ultramarine</div>
            <div>200 lpi half-tone screen</div>
          </div>
        </div>
      </motion.header>

      {/* ── SIDE RAIL (lg+) ──────────────────────────────────── */}
      <div
        aria-hidden
        className="hidden lg:block absolute right-3 top-1/2 -translate-y-1/2 rotate-90 origin-center z-10 pointer-events-none whitespace-nowrap"
        style={{
          color: paper.ink,
          fontFamily: "var(--p-mono), ui-monospace, monospace",
          fontSize: "10.5px",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        OUSS · PRESS ` FOR TERMINAL MODE · MMXXVI
      </div>

      {/* ── EYEBROW: status + manifesto + feature stamp ─────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.2 : 0.55, ease, delay: reduced ? 0 : 0.18 }}
        className="relative z-10 mt-7 sm:mt-10 lg:mt-12 flex items-center gap-3 sm:gap-4 flex-wrap"
      >
        {profile.available && (
          <span
            className="inline-flex items-center gap-2 px-2.5 py-1.5"
            style={{
              border: `1.5px solid ${paper.ink}`,
              background: paper.paperWarm,
              fontFamily: "var(--p-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: paper.ink,
              fontWeight: 700,
            }}
          >
            <motion.span
              aria-hidden
              className="block rounded-full"
              style={{ width: 8, height: 8, background: paper.red }}
              animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
              transition={
                reduced ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              }
            />
            available · {city}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--p-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: paper.navy,
            fontWeight: 700,
          }}
        >
          Manifesto № 01 — selected software
        </span>
        <PrintedStamp color={paper.red} rotate={-3.5}>
          ★ feature
        </PrintedStamp>
      </motion.div>

      {/* ── HEADLINE (focal point) ───────────────────────────── */}
      <h1
        className="relative z-10 mt-6 sm:mt-8 lg:mt-6 font-[family-name:var(--p-display)] tracking-[-0.04em] uppercase leading-[0.84]"
        style={{ fontSize: "clamp(2.1rem, 8vw, 7.5rem)", color: paper.ink }}
      >
        <BlockReveal delay={0.4} doublePrint>
          building
        </BlockReveal>
        <BlockReveal delay={0.55} accent={paper.red} doublePrintColor={paper.navy}>
          considered
        </BlockReveal>
        <BlockReveal delay={0.7} doublePrint>
          software.
        </BlockReveal>
      </h1>

      {/* ── TAGLINE + CTA RAIL ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 1.05, duration: reduced ? 0.2 : 0.7, ease }}
        className="relative z-10 mt-5 sm:mt-7 lg:mt-5 grid grid-cols-12 gap-x-6 gap-y-4 items-end"
      >
        <div className="col-span-12 md:col-span-7 lg:col-span-6">
          <p
            className="text-[15px] sm:text-[16px] leading-[1.55] max-w-[58ch]"
            style={{ color: paper.ink, fontWeight: 500 }}
          >
            {profile.tagline}
          </p>
          <p
            className="mt-3 hidden sm:block"
            style={{
              fontFamily: "var(--p-mono), monospace",
              fontSize: "10.5px",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: paper.ink,
              opacity: 0.7,
              fontWeight: 600,
            }}
          >
            — {profile.role}
          </p>
        </div>

        <div className="col-span-12 md:col-span-5 lg:col-span-4 lg:col-start-9 grid grid-cols-2 gap-2 sm:gap-3">
          <PaperCTA
            href="#works"
            bg={paper.ink}
            fg={paper.paper}
            shadow={paper.orange}
            reduced={!!reduced}
            label="View works"
          >
            works <span aria-hidden>↓</span>
          </PaperCTA>
          <PaperCTA
            href={`mailto:${profile.email}`}
            bg={paper.red}
            fg={paper.paper}
            shadow={paper.navy}
            reduced={!!reduced}
            label={`Email ${profile.email}`}
          >
            contact <span aria-hidden>↗</span>
          </PaperCTA>
        </div>
      </motion.div>

      {/* ── SCROLL HINT ──────────────────────────────────────── */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduced ? 0 : 1.4, duration: 0.6 }}
        className="relative z-10 mt-6 sm:mt-8 hidden sm:flex items-center gap-3"
        style={{
          fontFamily: "var(--p-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: paper.ink,
          opacity: 0.55,
          fontWeight: 600,
        }}
      >
        <motion.span
          animate={reduced ? undefined : { y: [0, 4, 0] }}
          transition={
            reduced ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          }
        >
          ↓
        </motion.span>
        scroll · turn the page
      </motion.div>
    </section>
  );
}

function PaperCTA({
  href,
  bg,
  fg,
  shadow,
  reduced,
  label,
  children,
}: {
  href: string;
  bg: string;
  fg: string;
  shadow: string;
  reduced: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.a
      href={href}
      aria-label={label}
      whileHover={reduced ? undefined : { x: -1.5, y: -1.5 }}
      whileTap={reduced ? undefined : { x: 1, y: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="inline-flex items-center justify-between gap-2 px-4 sm:px-5 py-3 text-[11.5px] sm:text-[12.5px] uppercase tracking-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: bg,
        color: fg,
        fontWeight: 700,
        minHeight: 44,
        fontFamily: "var(--p-mono), monospace",
        boxShadow: `3px 3px 0 ${shadow}`,
        outlineColor: paper.ink,
      }}
    >
      {children}
    </motion.a>
  );
}

function PaperRunningBar() {
  return (
    <div
      className="relative z-[3] border-y-[3px] py-3 px-8 lg:px-16 flex flex-wrap items-center gap-x-6 gap-y-1"
      style={{
        borderColor: paper.ink,
        background: paper.bone,
        color: paper.ink,
        fontFamily: "var(--p-mono), monospace",
        fontSize: "11px",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      <span style={{ color: paper.red }}>I works</span>
      <span style={{ color: paper.navy }}>II programme</span>
      <span style={{ color: paper.red }}>III voices</span>
      <span style={{ color: paper.navy }}>IV the maker</span>
      <span style={{ color: paper.red }}>V studies</span>
      <span style={{ color: paper.navy }}>VI dispatch</span>
      <span className="ml-auto" style={{ color: paper.ink, opacity: 0.55 }}>
        ✶ printed in two inks
      </span>
    </div>
  );
}

function PaperProjects() {
  return (
    <section id="works" className="relative z-[3] px-8 lg:px-16 pt-20 pb-2">
      <ProgrammeHead numeral="I" label="Works" color={paper.red} />
      <h2
        className="mt-6 max-w-4xl font-[family-name:var(--p-display)] uppercase tracking-[-0.04em] leading-[0.86]"
        style={{ fontSize: "clamp(2.2rem, 6vw, 4.2rem)", color: paper.ink, fontWeight: 700 }}
      >
        <span style={{ color: paper.navy }}>six</span> things, made{" "}
        <span style={{ color: paper.red }}>well</span>.
      </h2>
      <div
        className="mt-12 border-t-[3px]"
        style={{ borderColor: paper.ink }}
      >
        {projects.map((p, i) => (
          <PaperProjectRow key={p.title} project={p} index={i} />
        ))}
      </div>
    </section>
  );
}

function PaperProjectRow({
  project,
  index,
}: {
  project: (typeof projects)[number];
  index: number;
}) {
  const shapes: ("circle" | "square" | "triangle")[] = ["circle", "square", "triangle"];
  const colors = [paper.red, paper.navy, paper.mustard];
  const shape = shapes[index % 3];
  const color = colors[index % 3];
  return (
    <motion.a
      href={project.href ?? "#"}
      target={project.href && project.href !== "#" ? "_blank" : undefined}
      rel={project.href && project.href !== "#" ? "noopener noreferrer" : undefined}
      aria-label={`${project.title} project, opens in new tab`}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.6, ease, delay: (index % 3) * 0.05 }}
      whileHover={{ x: 4 }}
      className="group block border-b-[3px] py-9 md:py-12 grid grid-cols-12 gap-x-6 items-center focus-visible:outline-none focus-visible:bg-[color:rgba(230,57,70,0.08)]"
      style={{ borderColor: paper.ink, touchAction: "manipulation" }}
    >
      <div className="col-span-12 md:col-span-2 flex items-center gap-4">
        <span
          aria-hidden
          className="font-[family-name:var(--p-display)] leading-[0.78]"
          style={{
            fontSize: "clamp(3.2rem, 6vw, 4.8rem)",
            color: paper.ink,
            fontWeight: 700,
            textShadow: `2px 1.4px 0 ${paper.orange}`,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <ProjectPlate shape={shape} color={color} index={index} />
      </div>
      <div className="col-span-12 md:col-span-7">
        <h3
          className="font-[family-name:var(--p-display)] uppercase tracking-[-0.03em] leading-[0.92]"
          style={{
            fontSize: "clamp(1.8rem, 4.2vw, 3.2rem)",
            color: paper.ink,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              color,
              textShadow:
                color === paper.mustard
                  ? `2px 1.2px 0 ${paper.navy}`
                  : `2px 1.2px 0 ${paper.orange}`,
            }}
          >
            {project.title.toLowerCase()}
          </span>{" "}
          <span style={{ color: paper.ink }}>·</span>{" "}
          <span style={{ fontSize: "0.55em" }}>
            {project.tags[0].toLowerCase()}
          </span>
        </h3>
        <p
          className="mt-2 max-w-2xl text-[15px] leading-[1.55]"
          style={{ color: paper.ink, fontWeight: 500 }}
        >
          {project.blurb}
        </p>
      </div>
      <div className="col-span-12 md:col-span-3 mt-3 md:mt-0 md:text-right">
        <div
          className="font-[family-name:var(--p-mono)] text-[10.5px] uppercase tracking-[0.22em]"
          style={{ color: paper.ink, fontWeight: 700 }}
        >
          year · {project.year}
        </div>
        {project.metric ? (
          <div
            className="mt-2 font-[family-name:var(--p-display)] uppercase tracking-[-0.02em] leading-[0.9]"
            style={{
              fontSize: "1.5rem",
              color,
              fontWeight: 700,
              textShadow:
                color === paper.mustard
                  ? `1.6px 1px 0 ${paper.navy}`
                  : `1.6px 1px 0 ${paper.orange}`,
            }}
          >
            {project.metric.value}
          </div>
        ) : null}
        <div
          className="mt-1 font-[family-name:var(--p-mono)] text-[10.5px] uppercase tracking-[0.18em]"
          style={{ color: paper.ink }}
        >
          {project.metric?.label.toLowerCase() ?? "live"}
        </div>
        {index === 0 ? (
          <div className="mt-3 inline-block md:hidden lg:inline-block">
            <PrintedStamp color={paper.navy} rotate={4}>
              ★ shipped
            </PrintedStamp>
          </div>
        ) : null}
      </div>
    </motion.a>
  );
}

function PaperExperience() {
  return (
    <section
      className="relative z-[3] px-8 lg:px-16 py-20 overflow-hidden"
      style={{ background: paper.navy, color: paper.paper }}
    >
      {/* halftone radial — riso ink fade across the navy panel */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <HalftoneRadial color={paper.mustard} cx={0.85} cy={0.15} intensity={0.85} />
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <HalftoneRadial color={paper.red} cx={0.1} cy={0.9} intensity={0.55} />
      </div>

      <ProgrammeHead
        numeral="II"
        label="Programme"
        color={paper.mustard}
        dark
        ghost={paper.red}
      />
      <h2
        className="relative z-10 mt-6 max-w-4xl font-[family-name:var(--p-display)] uppercase tracking-[-0.04em] leading-[0.88]"
        style={{
          fontSize: "clamp(2rem, 5.4vw, 4rem)",
          color: paper.paper,
          fontWeight: 700,
          textShadow: `2.2px 1.4px 0 ${paper.red}`,
        }}
      >
        history of{" "}
        <span
          style={{
            color: paper.mustard,
            textShadow: `2.2px 1.4px 0 ${paper.red}`,
          }}
        >
          shipped work
        </span>
        .
      </h2>
      <ol className="relative z-10 mt-12 grid grid-cols-12 gap-x-6 gap-y-12">
        {experience.map((role, i) => (
          <motion.li
            key={role.company}
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.6, ease, delay: i * 0.05 }}
            className="col-span-12 md:col-span-4 relative"
          >
            <div
              aria-hidden
              className="absolute -left-2 -top-10 font-[family-name:var(--p-display)] leading-[0.78]"
              style={{ fontSize: "7rem", color: paper.mustard, opacity: 0.18, fontWeight: 700 }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div
              className="relative font-[family-name:var(--p-mono)] text-[11px] uppercase tracking-[0.22em]"
              style={{ color: paper.mustard, fontWeight: 700 }}
            >
              {role.start}–{role.end} · {role.location.toLowerCase()}
            </div>
            <h3
              className="relative mt-3 font-[family-name:var(--p-display)] uppercase tracking-[-0.025em] leading-[0.95]"
              style={{ fontSize: "1.5rem", color: paper.paper, fontWeight: 700 }}
            >
              {role.role.toLowerCase()}
            </h3>
            <div
              className="relative mt-1 font-[family-name:var(--p-display)] uppercase leading-[0.95]"
              style={{ fontSize: "1.1rem", color: paper.mustard, fontWeight: 700 }}
            >
              {role.company.toLowerCase()}
            </div>
            <p
              className="relative mt-3 text-[14px] leading-[1.55]"
              style={{ color: "#D9D9D9" }}
            >
              {role.summary}
            </p>
            <ul className="relative mt-3 space-y-1.5">
              {role.highlights.slice(0, 2).map((h) => (
                <li
                  key={h}
                  className="flex gap-2 text-[13.5px] leading-[1.5]"
                  style={{ color: "#D9D9D9" }}
                >
                  <span style={{ color: paper.red, fontWeight: 700 }}>■</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function PaperTestimonials() {
  const palette = [paper.red, paper.navy, paper.mustard, paper.ink];
  const ghosts = [paper.navy, paper.orange, paper.red, paper.orange];
  return (
    <section className="relative z-[3] px-8 lg:px-16 py-20">
      <ProgrammeHead numeral="III" label="Voices" color={paper.red} ghost={paper.navy} />
      <div className="mt-12 grid grid-cols-12 gap-4">
        {testimonials.map((t, i) => {
          const c = palette[i % palette.length];
          const ghost = ghosts[i % ghosts.length];
          const fg = c === paper.mustard ? paper.ink : paper.paper;
          return (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="col-span-12 md:col-span-6 relative p-7 md:p-9 overflow-hidden"
              style={{ background: c, color: fg }}
            >
              {/* halftone overlay — riso ink screen */}
              <div className="absolute inset-0 pointer-events-none">
                <HalftoneRadial
                  color={ghost}
                  cx={i % 2 === 0 ? 0.85 : 0.15}
                  cy={i % 2 === 0 ? 0.2 : 0.8}
                  intensity={0.7}
                />
              </div>
              <span
                aria-hidden
                className="absolute top-4 left-5 font-[family-name:var(--p-display)] leading-[0.7] z-10"
                style={{
                  fontSize: "7rem",
                  color: fg,
                  opacity: 0.45,
                  fontWeight: 700,
                  textShadow: `3px 2px 0 ${ghost}`,
                }}
              >
                &ldquo;
              </span>
              <blockquote
                className="relative z-10 font-[family-name:var(--p-display)] uppercase tracking-[-0.03em] leading-[0.94]"
                style={{
                  fontSize: "clamp(1.2rem, 1.7vw, 1.55rem)",
                  color: fg,
                  fontWeight: 700,
                  textShadow: `1.6px 1px 0 ${ghost}`,
                }}
              >
                {t.quote}
              </blockquote>
              <figcaption
                className="relative z-10 mt-7 font-[family-name:var(--p-mono)] text-[10.5px] uppercase tracking-[0.22em] flex items-baseline gap-3 flex-wrap"
                style={{ color: fg, opacity: 0.9, fontWeight: 700 }}
              >
                <span>— {t.name} · {t.role.toLowerCase()} · {t.org.toLowerCase()}</span>
                {i === 0 ? (
                  <span className="ml-auto inline-block">
                    <PrintedStamp color={paper.paper} bg={paper.ink} rotate={-2}>
                      ★ verified
                    </PrintedStamp>
                  </span>
                ) : null}
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
    </section>
  );
}

function PaperAboutAcademic() {
  return (
    <section
      className="relative z-[3] px-8 lg:px-16 py-20 overflow-hidden"
      style={{ background: paper.bone }}
    >
      <ProgrammeHead numeral="IV" label="The Maker" color={paper.navy} />
      <div className="mt-10 grid grid-cols-12 gap-x-6">
        <div className="col-span-12 md:col-span-5 relative">
          <PaperComposition />
        </div>
        <div className="col-span-12 md:col-span-6 md:col-start-7 mt-12 md:mt-0">
          <h2
            className="font-[family-name:var(--p-display)] uppercase tracking-[-0.035em] leading-[0.88]"
            style={{ fontSize: "clamp(2rem, 4.4vw, 3.2rem)", color: paper.ink, fontWeight: 700 }}
          >
            one engineer.
            <br />
            <span style={{ color: paper.red }}>built to ship.</span>
          </h2>
          <p
            className="mt-5 max-w-md text-[15.5px] leading-[1.6]"
            style={{ color: paper.ink, fontWeight: 500 }}
          >
            {profile.name.toLowerCase()}. software engineer. {profile.location}.
            designs and builds performant, opinionated software — from full-stack
            platforms to interfaces engineered for speed and clarity.
          </p>
          <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
            {values.map((v, i) => (
              <li
                key={v.k}
                className="border-[3px] p-4"
                style={{
                  borderColor: paper.ink,
                  background: i % 2 === 0 ? paper.paper : paper.mustard,
                }}
              >
                <div
                  className="font-[family-name:var(--p-display)] uppercase tracking-[-0.02em]"
                  style={{ fontSize: "1rem", color: paper.ink, fontWeight: 700 }}
                >
                  {v.k}
                </div>
                <p className="mt-1 text-[13.5px] leading-[1.5]" style={{ color: paper.ink }}>
                  {v.v}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-16">
        <ProgrammeHead numeral="V" label="Studies" color={paper.red} />
        <ol className="mt-8 grid grid-cols-12 gap-4">
          {education.map((e, i) => (
            <motion.li
              key={e.institution}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 0.55, ease, delay: i * 0.05 }}
              className="col-span-12 md:col-span-4 border-[3px] p-5 relative"
              style={{ borderColor: paper.ink, background: paper.paper }}
            >
              <div
                aria-hidden
                className="absolute -top-4 left-4 px-2 py-0.5 font-[family-name:var(--p-mono)] text-[11px] uppercase tracking-[0.22em]"
                style={{
                  background:
                    i === 0 ? paper.red : i === 1 ? paper.navy : paper.mustard,
                  color: i === 2 ? paper.ink : paper.paper,
                  fontWeight: 700,
                }}
              >
                {e.start}–{e.end}
              </div>
              <div
                className="mt-2 font-[family-name:var(--p-display)] uppercase tracking-[-0.02em] leading-[0.95]"
                style={{ fontSize: "1.3rem", color: paper.ink, fontWeight: 700 }}
              >
                {e.institution}
              </div>
              <div
                className="mt-1 font-[family-name:var(--p-mono)] text-[12px] uppercase tracking-[0.18em]"
                style={{ color: paper.navy, fontWeight: 700 }}
              >
                {e.degree.toLowerCase()}
              </div>
              <p className="mt-3 text-[13.5px] leading-[1.55]" style={{ color: paper.ink }}>
                {e.detail}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PaperContact() {
  return (
    <section
      className="relative z-[3] overflow-hidden"
      style={{ background: paper.red, color: paper.paper }}
    >
      {/* navy circle overprint — multiply gives a deep maroon overlap */}
      <motion.div
        aria-hidden
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 1, ease, delay: 0.1 }}
        className="absolute z-0 pointer-events-none overflow-hidden"
        style={{
          top: "-8vw",
          left: "-8vw",
          width: "44vw",
          height: "44vw",
          borderRadius: "9999px",
          background: paper.navy,
          mixBlendMode: "multiply",
        }}
      >
        <RisoTexture color={paper.paper} opacity={0.12} />
      </motion.div>
      {/* halftone radial in lower-right corner */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <HalftoneRadial color={paper.mustard} cx={0.88} cy={0.85} intensity={0.95} />
      </div>

      <div className="relative z-10 px-8 lg:px-16 py-20">
        <ProgrammeHead
          numeral="VI"
          label="Dispatch"
          color={paper.mustard}
          dark
          ghost={paper.navy}
        />
        <h2
          className="mt-6 max-w-5xl font-[family-name:var(--p-display)] uppercase tracking-[-0.04em] leading-[0.86]"
          style={{
            fontSize: "clamp(2.6rem, 8vw, 7rem)",
            color: paper.paper,
            fontWeight: 700,
            textShadow: `2.4px 1.6px 0 ${paper.navy}`,
          }}
        >
          send word.
          <br />
          <span
            style={{
              color: paper.mustard,
              textShadow: `2.4px 1.6px 0 ${paper.navy}`,
            }}
          >
            say something specific.
          </span>
        </h2>
        <div className="mt-12 grid grid-cols-12 gap-x-6 items-end">
          <div className="col-span-12 md:col-span-7">
            <a
              href={`mailto:${profile.email}`}
              className="font-[family-name:var(--p-display)] uppercase tracking-[-0.025em]"
              style={{
                fontSize: "clamp(1.4rem, 3.2vw, 2.4rem)",
                color: paper.paper,
                borderBottom: `4px solid ${paper.mustard}`,
                paddingBottom: "0.05em",
                fontWeight: 700,
              }}
            >
              {profile.email}
            </a>
            <ul
              className="mt-7 grid grid-cols-2 gap-y-1 font-[family-name:var(--p-mono)] text-[12px]"
              style={{ color: paper.paper, fontWeight: 700 }}
            >
              {profile.social.map((s) => (
                <li key={s.label}>
                  <span style={{ color: paper.mustard }}>{s.label.toUpperCase()}: </span>
                  {s.handle}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-3">
              <PrintedStamp color={paper.mustard} bg={paper.navy} rotate={-2.5}>
                ★ subscriber
              </PrintedStamp>
              <span
                className="font-[family-name:var(--p-mono)] text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: paper.paper, opacity: 0.7, fontWeight: 700 }}
              >
                replies usually within a day
              </span>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 mt-10 md:mt-0 relative">
            <a
              href={`mailto:${profile.email}`}
              className="block w-full text-center px-5 py-5 font-[family-name:var(--p-display)] uppercase tracking-[-0.02em]"
              style={{
                background: paper.paper,
                color: paper.red,
                fontSize: "1.3rem",
                minHeight: 44,
                border: `4px solid ${paper.ink}`,
                boxShadow: `8px 8px 0 ${paper.ink}`,
                fontWeight: 700,
              }}
            >
              write now ★
            </a>
            <div className="absolute -top-3 -right-2 z-10">
              <PrintedStamp color={paper.paper} bg={paper.ink} rotate={6}>
                ✦ paid
              </PrintedStamp>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaperColophon() {
  return (
    <div
      className="relative z-[3]"
      style={{ background: paper.ink, color: paper.paper }}
    >
      <div
        className="px-8 lg:px-16 py-5 grid grid-cols-12 gap-x-6 gap-y-3"
        style={{
          fontFamily: "var(--p-mono), monospace",
          fontSize: "10.5px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <div className="col-span-12 md:col-span-3">
          <div style={{ color: paper.mustard, opacity: 0.7 }}>colophon</div>
          <div className="mt-1">OUSS·ZINE №09</div>
          <div style={{ opacity: 0.65 }}>edition of 01 · 2026</div>
        </div>
        <div className="col-span-12 md:col-span-5">
          <div style={{ color: paper.mustard, opacity: 0.7 }}>set in</div>
          <div className="mt-1">
            <span style={{ color: paper.orange }}>Bricolage Grotesque</span>{" "}
            ·{" "}
            <span>Inter</span>{" "}
            ·{" "}
            <span style={{ color: paper.mustard }}>JetBrains Mono</span>
          </div>
          <div style={{ opacity: 0.65 }}>printed two inks · cadmium · ultramarine</div>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <div style={{ color: paper.mustard, opacity: 0.7 }}>secondary edition</div>
          <div className="mt-1">
            press{" "}
            <kbd
              className="px-1.5 py-0.5 rounded mx-0.5"
              style={{
                background: paper.mustard,
                color: paper.ink,
                fontWeight: 700,
              }}
            >
              `
            </kbd>{" "}
            for terminal mode
          </div>
          <div style={{ opacity: 0.65 }}>arch · catppuccin mocha</div>
        </div>
      </div>
      <div
        className="px-8 lg:px-16 py-2 border-t flex items-center justify-between"
        style={{
          borderColor: paper.mustard,
          fontFamily: "var(--p-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: paper.paper,
          opacity: 0.6,
        }}
      >
        <span>bendou · mmxxvi · casablanca</span>
        <span>200 lpi half-tone screen · 100% recycled paper</span>
        <span>— end —</span>
      </div>
    </div>
  );
}

function ProgrammeHead({
  numeral,
  label,
  color,
  dark,
  ghost,
}: {
  numeral: string;
  label: string;
  color: string;
  dark?: boolean;
  ghost?: string;
}) {
  const ghostColor = ghost ?? (dark ? paper.red : paper.orange);
  return (
    <div className="relative z-10 flex items-end gap-5">
      <span
        aria-hidden
        className="font-[family-name:var(--p-display)] leading-[0.78]"
        style={{
          fontSize: "clamp(3.6rem, 8vw, 6.4rem)",
          color,
          fontWeight: 700,
          textShadow: `2.6px 1.8px 0 ${ghostColor}`,
        }}
      >
        {numeral}
      </span>
      <span
        className="pb-2 font-[family-name:var(--p-mono)] text-[11px] uppercase tracking-[0.32em]"
        style={{ color: dark ? "#D9D9D9" : paper.ink, fontWeight: 700 }}
      >
        — {label}
      </span>
    </div>
  );
}

function Shape({
  kind,
  color,
  size,
}: {
  kind: "circle" | "square" | "triangle";
  color: string;
  size: number;
}) {
  if (kind === "circle") {
    return (
      <span
        aria-hidden
        className="inline-block"
        style={{ width: size, height: size, borderRadius: 9999, background: color }}
      />
    );
  }
  if (kind === "square") {
    return (
      <span
        aria-hidden
        className="inline-block"
        style={{ width: size, height: size, background: color }}
      />
    );
  }
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 100 86" aria-hidden>
      <polygon points="50,0 100,86 0,86" fill={color} />
    </svg>
  );
}

function PaperComposition() {
  return (
    <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
      <svg
        viewBox="0 0 600 600"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="comp-halftone" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.6" fill={paper.ink} fillOpacity="0.35" />
          </pattern>
        </defs>
        <rect width="600" height="600" fill={paper.bone} />
        <rect width="600" height="600" fill="url(#comp-halftone)" opacity="0.6" />
        {/* shapes use multiply via group filter — overlap = third tone */}
        <g style={{ mixBlendMode: "multiply" } as React.CSSProperties}>
          <circle cx="220" cy="240" r="160" fill={paper.red} />
        </g>
        <g style={{ mixBlendMode: "multiply" } as React.CSSProperties}>
          <rect x="260" y="270" width="240" height="240" fill={paper.navy} />
        </g>
        <g style={{ mixBlendMode: "multiply" } as React.CSSProperties}>
          <polygon points="370,80 520,300 240,300" fill={paper.mustard} />
        </g>
        {/* misregistered second-pass orange ghost */}
        <g style={{ mixBlendMode: "multiply" } as React.CSSProperties} opacity="0.55">
          <circle cx="226" cy="246" r="160" fill="none" stroke={paper.orange} strokeWidth="2" />
        </g>
        <line x1="50" y1="510" x2="550" y2="510" stroke={paper.ink} strokeWidth="6" />
        <text
          x="60"
          y="548"
          fontFamily="JetBrains Mono, monospace"
          fontSize="14"
          fill={paper.ink}
          letterSpacing="2"
        >
          THE MAKER · 1:1 STUDY
        </text>
      </svg>
    </div>
  );
}

function BlockReveal({
  children,
  delay = 0,
  accent,
  doublePrint,
  doublePrintColor,
}: {
  children: React.ReactNode;
  delay?: number;
  accent?: string;
  doublePrint?: boolean;
  doublePrintColor?: string;
}) {
  const reduced = useReducedMotion();
  const ghost = doublePrintColor ?? (doublePrint ? paper.orange : undefined);
  return (
    <span className="block overflow-hidden" style={{ paddingBottom: "0.04em" }}>
      <motion.span
        className="block"
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1 } : { y: "0%" }}
        transition={
          reduced
            ? { duration: 0.2, ease, delay: Math.min(delay, 0.2) }
            : { duration: 0.85, ease, delay }
        }
        style={{
          color: accent ?? paper.ink,
          textShadow: ghost ? `2.5px 1.5px 0 ${ghost}` : undefined,
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}

// ────── riso helper components ──────

function RisoTexture({
  color = paper.ink,
  opacity = 0.18,
}: {
  color?: string;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      {Array.from({ length: 18 }).map((_, row) =>
        Array.from({ length: 18 }).map((_, col) => {
          const x = (col + 0.5) * (200 / 18);
          const y = (row + 0.5) * (200 / 18);
          // pseudo-random scatter — inkjet/risograph paper feel
          const noise = ((row * 13 + col * 7 + row * col) % 11) / 11;
          const r = 0.4 + noise * 1.4;
          return (
            <circle
              key={`${row}-${col}`}
              cx={x}
              cy={y}
              r={r}
              fill={color}
              fillOpacity={opacity}
            />
          );
        })
      )}
    </svg>
  );
}

function HalftoneRadial({
  color = paper.ink,
  cx = 0.5,
  cy = 0.5,
  intensity = 1,
}: {
  color?: string;
  cx?: number;
  cy?: number;
  intensity?: number;
}) {
  const cols = 28;
  const rows = 22;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols * 20} ${rows * 20}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      style={{ mixBlendMode: "multiply" }}
    >
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => {
          const x = col * 20 + 10;
          const y = row * 20 + 10;
          const cxPx = cx * cols * 20;
          const cyPx = cy * rows * 20;
          const dx = x - cxPx;
          const dy = y - cyPx;
          const d = Math.sqrt(dx * dx + dy * dy);
          const r = Math.max(0, (5 - d / 55) * intensity);
          if (r < 0.25) return null;
          return (
            <circle
              key={`${row}-${col}`}
              cx={x}
              cy={y}
              r={r}
              fill={color}
              fillOpacity={0.7}
            />
          );
        })
      )}
    </svg>
  );
}

function ProjectPlate({
  shape,
  color,
  index,
}: {
  shape: "circle" | "square" | "triangle";
  color: string;
  index: number;
}) {
  const ghost = color === paper.mustard ? paper.navy : paper.orange;
  return (
    <div
      className="relative shrink-0 border-[2.5px] overflow-hidden"
      style={{
        width: 56,
        height: 56,
        borderColor: paper.ink,
        background: paper.paperWarm,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {/* misregistered ghost shape (offset by 3px) */}
        <g
          style={{ mixBlendMode: "multiply" } as React.CSSProperties}
          opacity="0.85"
          transform="translate(4 3)"
        >
          {shape === "circle" ? (
            <circle cx="50" cy="50" r="32" fill={ghost} />
          ) : shape === "square" ? (
            <rect x="20" y="20" width="60" height="60" fill={ghost} />
          ) : (
            <polygon points="50,18 80,80 20,80" fill={ghost} />
          )}
        </g>
        {/* primary ink shape */}
        <g style={{ mixBlendMode: "multiply" } as React.CSSProperties}>
          {shape === "circle" ? (
            <circle cx="50" cy="50" r="32" fill={color} />
          ) : shape === "square" ? (
            <rect x="20" y="20" width="60" height="60" fill={color} />
          ) : (
            <polygon points="50,18 80,80 20,80" fill={color} />
          )}
        </g>
        {/* halftone dots */}
        {Array.from({ length: 10 }).map((_, row) =>
          Array.from({ length: 10 }).map((_, col) => {
            const x = (col + 0.5) * 10;
            const y = (row + 0.5) * 10;
            const dx = x - 50,
              dy = y - 50;
            const d = Math.sqrt(dx * dx + dy * dy);
            const r = Math.max(0, 1.6 - d / 38);
            if (r < 0.2) return null;
            return (
              <circle
                key={`${row}-${col}`}
                cx={x}
                cy={y}
                r={r}
                fill={paper.ink}
                fillOpacity="0.45"
              />
            );
          })
        )}
        <text
          x="6"
          y="94"
          fontFamily="JetBrains Mono, monospace"
          fontSize="7"
          fill={paper.ink}
          fillOpacity="0.7"
          letterSpacing="0.6"
        >
          PL.{String(index + 1).padStart(2, "0")}
        </text>
      </svg>
    </div>
  );
}

function PrintedStamp({
  children,
  color = paper.red,
  bg,
  rotate = -3,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  rotate?: number;
}) {
  return (
    <span
      className="inline-block px-3 py-1"
      style={{
        background: bg ?? color,
        color: bg ? color : paper.paper,
        boxShadow: `3px 3px 0 ${paper.ink}`,
        transform: `rotate(${rotate}deg)`,
        fontFamily: "var(--p-mono), monospace",
        fontSize: "10.5px",
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      {children}
    </span>
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
        className="relative z-10 mx-auto max-w-[1100px] mt-4 mb-4 rounded-[10px] overflow-hidden border"
        style={{
          borderColor: cat.surface1,
          background: cat.base,
          boxShadow: `0 30px 60px -20px ${cat.crust}`,
        }}
      >
        {/* WINDOW CHROME */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: cat.surface0, background: cat.crust }}
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: cat.red }} />
            <span className="h-3 w-3 rounded-full" style={{ background: cat.yellow }} />
            <span className="h-3 w-3 rounded-full" style={{ background: cat.green }} />
          </div>
          <div className="text-[12px]" style={{ color: cat.subtext0 }}>
            <span style={{ color: cat.green }}>ouss</span>
            <span style={{ color: cat.overlay0 }}>@</span>
            <span style={{ color: cat.sapphire }}>arch</span>
            <span style={{ color: cat.overlay0 }}>:</span>
            <span style={{ color: cat.lavender }}>{active.cmd}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px]" style={{ color: cat.overlay1 }}>
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
                  className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: isActive ? w.tone : "transparent",
                    color: isActive ? cat.crust : cat.subtext0,
                    minHeight: 36,
                    fontWeight: isActive ? 700 : 500,
                    touchAction: "manipulation",
                  }}
                  title={`Press ${w.n}`}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7 }} aria-hidden>{w.n}</span>
                  <span>{w.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="px-3 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
              aria-label="Toggle keyboard help"
              aria-expanded={helpOpen}
              aria-keyshortcuts="?"
              title="Press ?"
              style={{
                background: helpOpen ? cat.lavender : "transparent",
                color: helpOpen ? cat.crust : cat.subtext0,
                minHeight: 36,
                touchAction: "manipulation",
              }}
            >
              ?
            </button>
            <button
              onClick={() => setShellOpen((v) => !v)}
              className="px-3 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
              aria-label="Toggle shell"
              aria-expanded={shellOpen}
              aria-keyshortcuts="`"
              title="Press ` to toggle"
              style={{
                background: shellOpen ? cat.green : "transparent",
                color: shellOpen ? cat.crust : cat.subtext0,
                minHeight: 36,
                fontWeight: 600,
                touchAction: "manipulation",
              }}
            >
              <span aria-hidden>❯ </span>shell
            </button>
            <button
              onClick={onToggle}
              aria-label="Switch to paper mode"
              aria-keyshortcuts="Escape"
              title="Press Escape"
              className="px-3 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: cat.surface0,
                color: cat.lavender,
                fontWeight: 600,
                minHeight: 36,
                touchAction: "manipulation",
              }}
            >
              [ paper mode ]
            </button>
          </div>
        </nav>

        {/* WORKSPACE BREADCRUMB */}
        <div
          className="flex items-center justify-between px-6 py-3 border-b text-[12px]"
          style={{ borderColor: cat.surface0, background: cat.base }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: cat.green }}>❯</span>
            <span style={{ color: cat.subtext1 }}>cd</span>
            <span style={{ color: active.tone, fontWeight: 600 }}>{active.cmd}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: cat.overlay1 }}>
            <span>workspace {String(active.n).padStart(2, "0")} of 06</span>
          </div>
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="relative min-h-[640px] overflow-hidden">
          <AnimatePresence mode="wait" custom={workspaceDir}>
            <motion.div
              key={active.slug}
              custom={workspaceDir}
              initial={
                reduced
                  ? { opacity: 0 }
                  : (d: 1 | -1) => ({ opacity: 0, x: d * 28 })
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : (d: 1 | -1) => ({ opacity: 0, x: -d * 28 })
              }
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
              className="px-2 py-0.5 rounded"
              style={{ background: active.tone, color: cat.crust, fontWeight: 700 }}
            >
              {profile.location.split(" · ")[0]}
            </span>
            <span style={{ color: cat.overlay1 }}>·</span>
            <span
              className="px-2 py-0.5 rounded"
              style={{
                background: shellOpen ? cat.green : cat.surface0,
                color: shellOpen ? cat.crust : cat.subtext0,
                fontWeight: 700,
              }}
            >
              {shellOpen ? "COMMAND" : "NORMAL"}
            </span>
            <span style={{ color: cat.green }}>● available</span>
          </div>
          <div className="hidden md:flex items-center gap-3" style={{ color: cat.overlay1 }}>
            <span>arch · linux 6.14</span>
            <span style={{ color: cat.surface2 }}>·</span>
            <span>catppuccin mocha</span>
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
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        background: `radial-gradient(${cat.surface0} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
        backgroundPosition: "-1px -1px",
        opacity: 0.5,
      }}
    />
  );
}

// ────── workspace contents ──────

function TerminalHome() {
  return (
    <section className="grid grid-cols-12 gap-x-8 gap-y-8 items-center">
      <div className="col-span-12 md:col-span-7">
        <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.peach }}>
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
        <div className="rounded-md border p-6" style={{ borderColor: cat.surface0, background: cat.mantle }}>
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
            className="group rounded-md border p-5 transition-colors hover:border-current focus-visible:outline-none focus-visible:ring-2"
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
                    className="px-2 py-0.5 rounded text-[10.5px] uppercase tracking-[0.12em]"
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
        tone={cat.peach}
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
                    className="px-2 py-0.5 rounded text-[10.5px] uppercase tracking-[0.12em]"
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
            className="rounded-md border p-6"
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
          <h3 className="mt-10 text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.peach }}>
            $ cat principles.txt
          </h3>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {values.map((v) => (
              <li key={v.k} className="rounded-md border p-4" style={{ borderColor: cat.surface0, background: cat.mantle }}>
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
          <h3 className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.peach }}>
            $ ls studies/
          </h3>
          <ol className="mt-4 space-y-5">
            {education.map((e) => (
              <li key={e.institution} className="rounded-md border p-4" style={{ borderColor: cat.surface0, background: cat.mantle }}>
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
          <div className="rounded-md border p-6" style={{ borderColor: cat.surface0, background: cat.mantle }}>
            <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: cat.teal }}>status</div>
            <div className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
              <KV k="open to" v="senior · staff" tone={cat.green} />
              <KV k="from" v="Q2 2026" tone={cat.peach} />
              <KV k="region" v="EU / remote" tone={cat.mauve} />
              <KV k="reply" v="≤ 1 day" tone={cat.lavender} />
            </div>
            <a
              href={`mailto:${profile.email}`}
              className="mt-6 inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-md text-[13px]"
              style={{ background: cat.teal, color: cat.crust, fontWeight: 700, minHeight: 44 }}
            >
              compose message →
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
        className="px-1.5 py-0.5 rounded"
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
                className="px-2 py-0.5 rounded"
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
        background: cat.lavender,
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
            className="relative max-w-2xl w-[92vw] max-h-[88vh] overflow-y-auto rounded-md border p-6"
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
                className="px-3 py-1.5 rounded text-[11px] focus-visible:outline-none focus-visible:ring-2"
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
        className="px-1.5 py-0.5 rounded text-[11px]"
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

const FILES = ["about.md", "contact.md", "principles.md", "projects.md", "reviews.md", "studies.md"];
const COMMANDS = [
  "help", "whoami", "pwd", "ls", "cd", "cat", "echo", "clear", "history", "exit", "date",
  "uname", "which", "neofetch", "fastfetch", "pacman", "git", "man", "tldr", "htop",
  "vim", "emacs", "sudo", "rm",
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
  const norm = f.replace(/\.md$/, "");
  switch (norm) {
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

