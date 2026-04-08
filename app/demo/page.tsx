"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─── Intersection Observer hook ──────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ─── Animated counter ────────────────────────────────────────────────────────

function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 2000,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const { ref, visible } = useInView(0.3);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [visible, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

// ─── Typewriter effect ───────────────────────────────────────────────────────

function TypewriterText({ lines, speed = 40 }: { lines: string[]; speed?: number }) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const { ref, visible } = useInView(0.3);

  useEffect(() => {
    if (!visible || currentLine >= lines.length) return;
    const timer = setTimeout(() => {
      if (currentChar < lines[currentLine].length) {
        setDisplayed((prev) => {
          const copy = [...prev];
          copy[currentLine] = (copy[currentLine] || "") + lines[currentLine][currentChar];
          return copy;
        });
        setCurrentChar((c) => c + 1);
      } else {
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }
    }, speed);
    return () => clearTimeout(timer);
  }, [visible, currentLine, currentChar, lines, speed]);

  return (
    <div ref={ref} className="font-mono text-[13px] leading-relaxed">
      {displayed.map((line, i) => (
        <div key={i} className="whitespace-pre">
          <span className="text-muted-foreground select-none mr-4 inline-block w-5 text-right">
            {i + 1}
          </span>
          <span
            dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }}
          />
          {i === currentLine && currentLine < lines.length && (
            <span className="inline-block w-[7px] h-4 bg-aegis-cyan animate-pulse ml-px translate-y-[3px]" />
          )}
        </div>
      ))}
    </div>
  );
}

function syntaxHighlight(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /"([^"]*)"(\s*:)/g,
      '<span class="text-[#7dd3fc]">"$1"</span>$2'
    )
    .replace(
      /:\s*"([^"]*)"/g,
      ': <span class="text-[#34d399]">"$1"</span>'
    )
    .replace(
      /:\s*(\d+)/g,
      ': <span class="text-[#fbbf24]">$1</span>'
    )
    .replace(
      /\b(true|false|null)\b/g,
      '<span class="text-[#c084fc]">$1</span>'
    );
}

// ─── Verdict badge animation ─────────────────────────────────────────────────

function VerdictBadge() {
  const [state, setState] = useState<"idle" | "evaluating" | "done">("idle");
  const { ref, visible } = useInView(0.5);

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setState("evaluating"), 600);
    const t2 = setTimeout(() => setState("done"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  return (
    <div ref={ref} className="flex items-center gap-3">
      {state === "idle" && (
        <div className="h-8 w-24 rounded-full bg-secondary/50" />
      )}
      {state === "evaluating" && (
        <div className="flex items-center gap-2 rounded-full bg-aegis-cyan/10 border border-aegis-cyan/30 px-4 py-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-aegis-cyan" />
          <span className="text-sm font-medium text-aegis-cyan">Evaluating...</span>
        </div>
      )}
      {state === "done" && (
        <div className="flex items-center gap-2 rounded-full bg-aegis-allow/10 border border-aegis-allow/30 px-4 py-1.5 animate-[scale-in_0.3s_ease-out]">
          <svg className="h-4 w-4 text-aegis-allow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-bold text-aegis-allow tracking-wide">ALLOW</span>
        </div>
      )}
    </div>
  );
}

// ─── Score Donut animation ───────────────────────────────────────────────────

function AnimatedDonut() {
  const [score, setScore] = useState(0);
  const { ref, visible } = useInView(0.4);
  const targetScore = 73;

  useEffect(() => {
    if (!visible) return;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      if (current >= targetScore) {
        setScore(targetScore);
        clearInterval(timer);
      } else {
        setScore(current);
      }
    }, 25);
    return () => clearInterval(timer);
  }, [visible]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f43f5e";

  return (
    <div ref={ref} className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-100 ease-linear"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { ref, visible } = useInView(0.1);
  return (
    <section
      ref={ref}
      id={id}
      className={`demo-fade-up ${visible ? "visible" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const policyLines = [
    '{',
    '  "Version": "2012-10-17",',
    '  "Statement": [{',
    '    "Sid": "AllowS3Read",',
    '    "Effect": "Allow",',
    '    "Action": ["s3:GetObject"],',
    '    "Resource": "arn:aws:s3:::prod/*"',
    '  }, {',
    '    "Sid": "DenyDelete",',
    '    "Effect": "Deny",',
    '    "Action": ["s3:DeleteObject"],',
    '    "Resource": "*"',
    '  }]',
    '}',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Background effects ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 dot-grid animate-grid-pulse" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-aegis-cyan/[0.03] blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#a78bfa]/[0.03] blur-[120px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
      </div>

      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aegis-cyan/10 border border-aegis-cyan/20">
              <svg className="h-4 w-4 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-base font-semibold">Aegis</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Demo</a>
            <a href="#clouds" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Multi-Cloud</a>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-aegis-cyan px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-aegis-cyan/90 transition-colors"
          >
            Launch Simulator
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="relative z-10 pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-aegis-cyan/20 bg-aegis-cyan/5 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-aegis-cyan animate-pulse" />
              <span className="text-xs font-medium text-aegis-cyan">
                Powered by Claude AI
              </span>
            </div>

            <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="block text-foreground">Prioritize and Remediate</span>
              <span
                className="block bg-gradient-to-r from-aegis-cyan via-[#67e8f9] to-[#a78bfa] bg-clip-text text-transparent animate-gradient-shift"
                style={{ backgroundSize: "200% 200%" }}
              >
                IAM Risks Faster.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed sm:text-xl">
              Generate secure policies, validate compliance, and autonomously
              audit your entire infrastructure. The Aegis IAM Security
              Platform is powered by agentic AI.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/"
                className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-aegis-cyan px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:bg-aegis-cyan/90"
              >
                Launch Simulator
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 px-8 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary/60 hover:border-border/80"
              >
                See it in action
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
              </a>
            </div>

            {/* Cloud providers */}
            <div className="mt-16 flex items-center gap-3 text-muted-foreground/40">
              <span className="text-xs uppercase tracking-widest">Works with</span>
              <div className="flex gap-4 text-muted-foreground/60">
                {["AWS", "Azure", "GCP"].map((name) => (
                  <span key={name} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-1 text-xs font-medium">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bento Feature Grid ── */}
      <Section id="features" className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-aegis-cyan uppercase tracking-widest mb-3">Capabilities</p>
            <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
              Three tools. One platform.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Everything you need to evaluate, monitor, and optimize IAM policies across every major cloud provider.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Policy Simulator - Large card */}
            <div className="glass-card glow-border rounded-2xl p-8 lg:col-span-2 transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-aegis-cyan/10 border border-aegis-cyan/20">
                    <svg className="h-5 w-5 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Policy Simulator</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Paste any IAM policy, define an access request, and get an instant verdict. Client-side evaluation runs in milliseconds. AI streams in a detailed explanation of why access was allowed or denied.
                  </p>
                </div>
                <VerdictBadge />
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 p-4 mt-4">
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-aegis-deny/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-aegis-warn/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-aegis-allow/80" />
                  <span className="ml-2 font-mono">policy.json</span>
                </div>
                <pre className="text-xs font-mono text-muted-foreground leading-5 overflow-hidden max-h-[140px]">
{`{
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::prod-data/*"
  }, {
    "Effect": "Deny",
    "Action": ["s3:Delete*"],
    "Resource": "*"
  }]
}`}
                </pre>
              </div>
            </div>

            {/* Drift Detector */}
            <div className="glass-card glow-border rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-aegis-warn/10 border border-aegis-warn/20">
                <svg className="h-5 w-5 text-aegis-warn" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Drift Detector</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Compare baseline vs current policy. Auto-detects added permissions, removed deny rules, broadened scopes, and scores each change by severity.
              </p>
              <div className="space-y-2">
                {[
                  { label: "Deny statement removed", severity: "CRITICAL", color: "text-aegis-deny border-aegis-deny/30 bg-aegis-deny/10" },
                  { label: "Resource changed to *", severity: "HIGH", color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
                  { label: "New action added", severity: "MEDIUM", color: "text-aegis-warn border-aegis-warn/30 bg-aegis-warn/10" },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${item.color}`}>
                    <span className="font-bold text-[10px] shrink-0">{item.severity}</span>
                    <span className="text-foreground/80">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Least Privilege */}
            <div className="glass-card glow-border rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/20">
                <svg className="h-5 w-5 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Least Privilege</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Feed in usage logs and your policy. See which permissions are actually used, get a compliance score, and AI recommendations for tightening access.
              </p>
              <div className="flex items-center justify-center">
                <AnimatedDonut />
              </div>
            </div>

            {/* AI Analysis - wide card */}
            <div className="glass-card glow-border rounded-2xl p-8 lg:col-span-2 transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start gap-6 flex-col sm:flex-row">
                <div className="flex-1">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-aegis-allow/10 border border-aegis-allow/20">
                    <svg className="h-5 w-5 text-aegis-allow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">AI-Powered Explanations</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Every verdict, drift item, and privilege recommendation comes with a plain-English explanation from Claude. Understand the "why" behind every access decision, not just the result.
                  </p>
                </div>
                <div className="flex-1 rounded-xl border border-border/50 bg-background/50 p-4 text-sm text-muted-foreground leading-relaxed">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-4 w-4 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span className="text-xs font-medium text-aegis-cyan">Claude Analysis</span>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-aegis-cyan animate-pulse" />
                  </div>
                  <p className="text-xs leading-5">
                    The request to <code className="text-aegis-cyan">s3:GetObject</code> on <code className="text-aegis-cyan">arn:aws:s3:::prod-data/reports/q4.csv</code> was <strong className="text-aegis-allow">ALLOWED</strong> by the AllowS3Read statement. This statement grants read access to all objects under the prod-data bucket. The DenyDelete statement was evaluated first but did not match since the action is a read operation, not a delete...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Live Demo ── */}
      <Section id="demo" className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-aegis-cyan uppercase tracking-widest mb-3">Live Preview</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Watch it evaluate in real time
            </h2>
          </div>

          <div className="demo-scale-in visible">
            <div className="rounded-2xl border border-border/50 bg-aegis-surface/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
              {/* Terminal header */}
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 bg-background/50">
                <span className="h-3 w-3 rounded-full bg-aegis-deny/60" />
                <span className="h-3 w-3 rounded-full bg-aegis-warn/60" />
                <span className="h-3 w-3 rounded-full bg-aegis-allow/60" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">aegis-iam-simulator -- policy-evaluation</span>
              </div>

              <div className="grid md:grid-cols-2 divide-x divide-border/30">
                {/* Policy editor */}
                <div className="p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">IAM Policy</p>
                  <TypewriterText lines={policyLines} speed={30} />
                </div>

                {/* Result */}
                <div className="p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Evaluation Result</p>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Request</span>
                      <div className="mt-1 rounded-lg border border-border/50 bg-background/30 px-3 py-2 font-mono text-xs">
                        <span className="text-aegis-cyan">s3:GetObject</span>
                        <span className="text-muted-foreground"> on </span>
                        <span className="text-aegis-allow">arn:aws:s3:::prod/report.csv</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Verdict</span>
                      <div className="mt-1">
                        <VerdictBadge />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Matched Statement</span>
                      <div className="mt-1 rounded-lg border border-aegis-allow/20 bg-aegis-allow/5 px-3 py-2 font-mono text-xs text-muted-foreground">
                        Statement[0]: AllowS3Read
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Multi-Cloud ── */}
      <Section id="clouds" className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-aegis-cyan uppercase tracking-widest mb-3">Multi-Cloud</p>
            <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
              One tool.{" "}
              <span className="bg-gradient-to-r from-[#ff9900] via-[#0078d4] to-[#4285f4] bg-clip-text text-transparent">
                Every cloud.
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Native evaluation logic for each provider. Not a translation layer, real IAM semantics.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "AWS",
                color: "#ff9900",
                features: ["Statement-level Deny/Allow evaluation", "Wildcard action + resource matching", "NotAction / NotResource support", "CloudTrail log integration"],
              },
              {
                name: "Azure",
                color: "#0078d4",
                features: ["Actions / NotActions RBAC evaluation", "DataActions support", "Scope hierarchy matching", "Role definition comparison"],
              },
              {
                name: "GCP",
                color: "#4285f4",
                features: ["Role-to-permission mapping", "IAM binding evaluation", "Condition expression handling", "Member + group matching"],
              },
            ].map((cloud) => (
              <div
                key={cloud.name}
                className="glass-card glow-border rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-bold"
                  style={{
                    backgroundColor: `${cloud.color}10`,
                    borderColor: `${cloud.color}30`,
                    color: cloud.color,
                  }}
                >
                  {cloud.name.charAt(0)}
                </div>
                <h3 className="text-lg font-semibold mb-4">{cloud.name}</h3>
                <ul className="space-y-2.5">
                  {cloud.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <svg className="h-4 w-4 shrink-0 mt-0.5 text-aegis-cyan/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── How It Works ── */}
      <Section className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-aegis-cyan uppercase tracking-widest mb-3">Workflow</p>
            <h2 className="text-3xl font-bold sm:text-4xl">Three steps to secure IAM</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Paste your policy",
                desc: "Drop in any IAM policy JSON. AWS, Azure, or GCP. Or load a sample to explore.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                ),
              },
              {
                step: "02",
                title: "Define the request",
                desc: "Specify the action, resource, and principal. The evaluator runs instantly in your browser.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                ),
              },
              {
                step: "03",
                title: "Get AI analysis",
                desc: "Claude explains the verdict, traces the evaluation logic, and recommends improvements.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                ),
              },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-aegis-cyan/30 to-transparent" />
                )}
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-aegis-cyan/10 border border-aegis-cyan/20">
                  <svg className="h-6 w-6 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {item.icon}
                  </svg>
                </div>
                <p className="text-xs font-bold text-aegis-cyan mb-2">{item.step}</p>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Stats ── */}
      <Section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: 3, suffix: "", label: "Cloud Providers" },
              { value: 100, suffix: "+", label: "IAM Permissions Mapped" },
              { value: 15, suffix: "+", label: "Drift Severity Rules" },
              { value: 0, suffix: "ms", label: "Client-Side Eval", prefix: "<50" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold text-foreground animate-counter-glow md:text-5xl">
                  {stat.prefix ? (
                    <span>{stat.prefix}</span>
                  ) : (
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-aegis-cyan/20 bg-gradient-to-br from-aegis-cyan/10 via-background to-[#a78bfa]/10 p-12 md:p-20 text-center">
            <div className="absolute inset-0 dot-grid opacity-50" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-aegis-cyan/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#a78bfa]/10 rounded-full blur-[100px]" />

            <div className="relative z-10">
              <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl mb-4">
                Ready to secure your IAM?
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8 text-lg">
                Stop guessing about policy permissions. Simulate, detect drift, and enforce least privilege with AI-powered analysis.
              </p>
              <Link
                href="/"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-aegis-cyan px-10 py-4 text-base font-semibold text-primary-foreground transition-all hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] hover:bg-aegis-cyan/90"
              >
                Launch Simulator
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-aegis-cyan/10 border border-aegis-cyan/20">
                <svg className="h-3.5 w-3.5 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Aegis IAM Simulator</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Built with Next.js, Tailwind CSS, and Claude. Open source.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
