import React, { Fragment } from "react";
import {
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  Stethoscope,
  Activity,
  BookOpen,
  ClipboardList,
  Pill,
  FlaskConical,
  ChevronRight,
} from "lucide-react";

/* ---------- Inline parser: bold / italic / code / links ---------- */

const INLINE_TOKEN_RE =
  /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_TOKEN_RE.lastIndex = 0;
  let i = 0;
  while ((m = INLINE_TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`${keyPrefix}-t-${i++}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={`${keyPrefix}-b-${i++}`} className="font-bold text-slate-900 dark:text-slate-50">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      out.push(
        <code
          key={`${keyPrefix}-c-${i++}`}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-[0.85em] text-natural-accent dark:text-emerald-300 border border-slate-200 dark:border-slate-700"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const linkM = /^\[([^\]]+?)\]\(([^)]+?)\)$/.exec(tok);
      if (linkM) {
        const url = linkM[2];
        const safeScheme = /^https?:\/\//i.test(url) || /^mailto:/i.test(url);
        const href = safeScheme ? url : "about:blank";
        out.push(
          <a
            key={`${keyPrefix}-l-${i++}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-0.5 font-semibold text-natural-accent dark:text-emerald-300 underline decoration-dotted underline-offset-2 hover:text-natural-accent"
          >
            {safeScheme ? linkM[1] : "[blocked]"}
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      } else {
        out.push(<Fragment key={`${keyPrefix}-r-${i++}`}>{tok}</Fragment>);
      }
    } else {
      out.push(
        <em key={`${keyPrefix}-i-${i++}`} className="italic text-slate-700 dark:text-slate-200">
          {tok.slice(1, -1)}
        </em>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={`${keyPrefix}-e-${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}

/* ---------- Block parser ---------- */

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "code"; text: string };

function parseMarkdown(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Fenced code
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    // ATX headings
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      blocks.push({ kind: "h3", text: h3[1].trim() });
      i++;
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      blocks.push({ kind: "h2", text: h2[1].trim() });
      i++;
      continue;
    }
    const h1 = /^#\s+(.+)$/.exec(line);
    if (h1) {
      blocks.push({ kind: "h1", text: h1[1].trim() });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    // Heading-as-bold-line: a line that is just **Heading** (or ***Heading***) - common in Gemini output
    const boldHeading = /^\*\*+\s*(.+?)\s*\*+\s*:?\s*$/.exec(line);
    if (boldHeading) {
      blocks.push({ kind: "h2", text: boldHeading[1].replace(/:$/, "").trim() });
      i++;
      continue;
    }

    // Bullet list: lines starting with -, *, or *\s (3 spaces) (Gemini style)
    const bulletRe = /^[ \t]*(?:-|\*|\+)\s+(.+)$/;
    const orderedRe = /^[ \t]*\d+\.\s+(.+)$/;
    // Also handle "•" and "–" bullets
    const altBulletRe = /^[ \t]*(?:•|–|—)\s+(.+)$/;
    if (bulletRe.test(line) || altBulletRe.test(line)) {
      const items: string[] = [];
      const activeRe = bulletRe.test(line) ? bulletRe : altBulletRe;
      while (i < lines.length && (bulletRe.test(lines[i]) || altBulletRe.test(lines[i]))) {
        const m = (bulletRe.test(lines[i]) ? bulletRe : altBulletRe).exec(lines[i])!;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (orderedRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && orderedRe.test(lines[i])) {
        const m = orderedRe.exec(lines[i])!;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Paragraph: accumulate consecutive non-empty, non-special lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^\*\*\*+\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !bulletRe.test(lines[i]) &&
      !orderedRe.test(lines[i]) &&
      !/^\*\*+\s*(.+?)\s*\*+\s*:?\s*$/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks;
}

/* ---------- Section detection for special styling ---------- */

type SectionKind = "redflag" | "followup" | "guideline" | "diagnosis" | "management" | "labs" | "meds" | "default";

function classifySection(heading: string): SectionKind {
  const t = heading.toLowerCase();
  if (/(red\s*flag|warning|critical|alert|abnormal|concern)/.test(t)) return "redflag";
  if (/(follow[- ]?up|next\s*step|next\s*question|suggested|questions?\s*to\s*ask)/.test(t)) return "followup";
  if (/(guideline|reference|reference|according\s*to|recommend|standard\s*of\s*care)/.test(t)) return "guideline";
  if (/(diagnos|staging|status|assessment|findings|summary)/.test(t)) return "diagnosis";
  if (/(management|treatment|therapy|chemo|radiat|surg|intervention|plan|approach)/.test(t)) return "management";
  if (/(lab|blood|marker|imaging|scan|biopsy|ihc|pathology|histolog)/.test(t)) return "labs";
  if (/(medic|chemo|drug|dose|regimen|protocol|line)/.test(t)) return "meds";
  return "default";
}

const sectionPalette: Record<SectionKind, { bar: string; chip: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  redflag: {
    bar: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
    icon: AlertTriangle,
    label: "Red Flag",
  },
  followup: {
    bar: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60",
    icon: MessageSquare,
    label: "Follow-up",
  },
  guideline: {
    bar: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    icon: BookOpen,
    label: "Guideline",
  },
  diagnosis: {
    bar: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60",
    icon: Stethoscope,
    label: "Assessment",
  },
  management: {
    bar: "bg-violet-500",
    chip: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60",
    icon: Activity,
    label: "Management",
  },
  labs: {
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    icon: FlaskConical,
    label: "Investigations",
  },
  meds: {
    bar: "bg-fuchsia-500",
    chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800/60",
    icon: Pill,
    label: "Therapy",
  },
  default: {
    bar: "bg-natural-accent",
    chip: "bg-natural-accent/10 text-natural-accent-dark border-natural-accent/30 dark:bg-natural-accent/20 dark:text-emerald-200 dark:border-natural-accent/40",
    icon: ClipboardList,
    label: "Note",
  },
};

/* ---------- Block-level component renderer ---------- */

function BlockView({ block, idx, animDelayMs }: { block: Block; idx: number; animDelayMs: number; key?: React.Key }) {
  const delay = { animationDelay: `${animDelayMs}ms` } as React.CSSProperties;
  const fadeUp = "fade-in-up opacity-0 [animation-fill-mode:forwards]";

  switch (block.kind) {
    case "h1":
      return (
        <h1
          key={idx}
          style={delay}
          className={`${fadeUp} text-base font-bold text-slate-900 dark:text-slate-50 mt-2 mb-1.5`}
        >
          {block.text}
        </h1>
      );
    case "h2": {
      const kind = classifySection(block.text);
      const p = sectionPalette[kind];
      const Icon = p.icon;
      return (
        <div
          key={idx}
          style={delay}
          className={`${fadeUp} mt-4 mb-3 first:mt-0`}
        >
          <div className="bg-theme-surface/50 dark:bg-slate-800/30 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-700/40 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${p.chip} border`}>
                <Icon className="h-3 w-3" />
              </span>
              <span className={`eyebrow px-1.5 py-0.5 rounded-md border ${p.chip}`}>
                {p.label}
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-snug">
                {block.text}
              </h2>
            </div>
            <div className={`h-0.5 w-12 rounded-full ${p.bar}`} />
          </div>
        </div>
      );
    }
    case "h3":
      return (
        <h3
          key={idx}
          style={delay}
          className={`${fadeUp} text-[13px] font-bold text-slate-800 dark:text-slate-100 mt-3 mb-1.5 px-1 border-l-2 border-natural-accent/60 pl-2.5`}
        >
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p
          key={idx}
          style={delay}
          className={`${fadeUp} text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 my-1.5 px-1`}
        >
          {renderInline(block.text, `p-${idx}`)}
        </p>
      );
    case "ul":
      return (
        <ul
          key={idx}
          style={delay}
          className={`${fadeUp} my-2 space-y-1.5 pl-1`}
        >
          {block.items.map((it, j) => (
            <li key={j} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 py-1 px-2 rounded-lg bg-theme-surface/30 dark:bg-slate-800/30 hover:bg-theme-surface/50 dark:hover:bg-slate-800/50 transition-colors">
              <ChevronRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-natural-accent dark:text-emerald-400" />
              <span className="flex-1">{renderInline(it, `ul-${idx}-${j}`)}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol
          key={idx}
          style={delay}
          className={`${fadeUp} my-2 space-y-1.5 pl-1 list-none counter-reset-[item]`}
        >
          {block.items.map((it, j) => (
            <li key={j} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 py-1 px-2 rounded-lg bg-theme-surface/30 dark:bg-slate-800/30 hover:bg-theme-surface/50 dark:hover:bg-slate-800/50 transition-colors">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-natural-accent/15 dark:bg-emerald-500/15 text-natural-accent dark:text-emerald-300 text-[11.5px] font-bold flex items-center justify-center border border-natural-accent/30 dark:border-emerald-500/30">
                {j + 1}
              </span>
              <span className="flex-1 pt-0.5">{renderInline(it, `ol-${idx}-${j}`)}</span>
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote
          key={idx}
          style={delay}
          className={`${fadeUp} my-2 pl-3 border-l-2 border-natural-accent/60 italic text-[12.5px] text-slate-600 dark:text-slate-300`}
        >
          {renderInline(block.text, `q-${idx}`)}
        </blockquote>
      );
    case "hr":
      return <hr key={idx} style={delay} className={`${fadeUp} my-3 border-t border-slate-200 dark:border-slate-700`} />;
    case "code":
      return (
        <pre
          key={idx}
          style={delay}
          className={`${fadeUp} my-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[11.5px] overflow-x-auto`}
        >
          {block.text}
        </pre>
      );
  }
}

/* ---------- Main component ---------- */

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  if (!blocks.length) {
    return <p className="text-xs italic text-slate-500">Empty response.</p>;
  }
  return (
    <div className="space-y-0.5">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} idx={i} animDelayMs={Math.min(i, 6) * 70} />
      ))}
    </div>
  );
}

/* ---------- Thinking dots (animated loading indicator) ---------- */

export function ThinkingDots({ label = "Gemini is compiling oncology guidelines" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 text-xs">
      <div className="flex items-end gap-1 h-4">
        <span className="thinking-dot" style={{ animationDelay: "0ms" }} />
        <span className="thinking-dot" style={{ animationDelay: "150ms" }} />
        <span className="thinking-dot" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="font-semibold tracking-wide">
        {label}
        <span className="dots-loader inline-block ml-0.5" aria-hidden="true" />
      </span>
    </div>
  );
}

export default ChatMarkdown;
