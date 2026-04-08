"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CloudProvider } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Finding {
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

interface ComplianceStatus {
  status: "pass" | "partial" | "fail";
  issues: number;
}

interface ValidationMeta {
  score: number;
  grade: string;
  findings: Finding[];
  compliance: {
    pci_dss: ComplianceStatus;
    hipaa: ComplianceStatus;
    sox: ComplianceStatus;
    gdpr: ComplianceStatus;
    cis: ComplianceStatus;
  };
}

// ─── Sample policies (intentionally insecure) ───────────────────────────────

const samplePolicies: Record<CloudProvider, string> = {
  aws: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Action: "*", Resource: "*" },
      { Effect: "Allow", Action: ["s3:DeleteBucket", "ec2:TerminateInstances"], Resource: "*" },
    ],
  }, null, 2),
  azure: JSON.stringify([{
    Name: "Overprivileged Role",
    Description: "Full access role",
    Actions: ["*"],
    NotActions: [],
    DataActions: [],
    NotDataActions: [],
    AssignableScopes: ["/"],
  }], null, 2),
  gcp: JSON.stringify({
    bindings: [
      { role: "roles/owner", members: ["allAuthenticatedUsers"] },
      { role: "roles/storage.admin", members: ["allUsers"] },
    ],
  }, null, 2),
};

// ─── Score Donut ─────────────────────────────────────────────────────────────

function ScoreDonut({ score, grade }: { score: number; grade: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f43f5e";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
        <span className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}>
          Grade {grade}
        </span>
      </div>
    </div>
  );
}

// ─── Severity config ─────────────────────────────────────────────────────────

const severityColors: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "text-aegis-deny", bg: "bg-aegis-deny/10", border: "border-aegis-deny/30" },
  high: { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" },
  medium: { text: "text-aegis-warn", bg: "bg-aegis-warn/10", border: "border-aegis-warn/30" },
  low: { text: "text-muted-foreground", bg: "bg-muted/20", border: "border-muted-foreground/20" },
};

const complianceColors: Record<string, { text: string; bg: string; label: string }> = {
  pass: { text: "text-aegis-allow", bg: "bg-aegis-allow/10", label: "PASS" },
  partial: { text: "text-aegis-warn", bg: "bg-aegis-warn/10", label: "PARTIAL" },
  fail: { text: "text-aegis-deny", bg: "bg-aegis-deny/10", label: "FAIL" },
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ValidatePage() {
  const [cloud, setCloud] = useState<CloudProvider>("aws");
  const [policy, setPolicy] = useState("");
  const [meta, setMeta] = useState<ValidationMeta | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const loadSample = useCallback(() => {
    setPolicy(samplePolicies[cloud]);
    setMeta(null);
    setAnalysis("");
    setError("");
  }, [cloud]);

  const handleCloudChange = useCallback((c: CloudProvider) => {
    setCloud(c);
    setPolicy("");
    setMeta(null);
    setAnalysis("");
    setError("");
  }, []);

  const validate = useCallback(async () => {
    setError("");
    setMeta(null);
    setAnalysis("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloud, policy }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Validation failed");
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setIsStreaming(false); return; }

      const decoder = new TextDecoder();
      let text = "";
      let metaParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });

        if (!metaParsed && text.includes(":END_META-->")) {
          const match = text.match(/<!--VALIDATE_META:(.*?):END_META-->/s);
          if (match) {
            try { setMeta(JSON.parse(match[1])); } catch { /* skip */ }
            text = text.replace(/<!--VALIDATE_META:.*?:END_META-->\n?/s, "");
            metaParsed = true;
          }
        }
        if (metaParsed) setAnalysis(text);
      }
      setIsStreaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
      setIsStreaming(false);
    }
  }, [cloud, policy]);

  const frameworks = meta ? [
    { key: "pci_dss", label: "PCI DSS", ...meta.compliance.pci_dss },
    { key: "hipaa", label: "HIPAA", ...meta.compliance.hipaa },
    { key: "sox", label: "SOX", ...meta.compliance.sox },
    { key: "gdpr", label: "GDPR", ...meta.compliance.gdpr },
    { key: "cis", label: "CIS", ...meta.compliance.cis },
  ] : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/demo" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-aegis-cyan/10 border border-aegis-cyan/20">
                <svg className="h-3.5 w-3.5 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Aegis</span>
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-sm text-muted-foreground">Policy Validator</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Simulator</Link>
            <Link href="/generate" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Generator</Link>
            <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Audit</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Cloud selector + actions */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
            {(["aws", "azure", "gcp"] as const).map((c) => (
              <button key={c} onClick={() => handleCloudChange(c)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-all", cloud === c ? "bg-aegis-cyan text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={loadSample} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all">
              Load Insecure Sample
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Policy input */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <label className="mb-2 block text-sm font-medium">Policy JSON</label>
              <textarea
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
                placeholder={`Paste your ${cloud.toUpperCase()} policy JSON here...`}
                className="h-[400px] w-full resize-none rounded-lg border border-border bg-background p-4 text-sm font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-aegis-cyan/50"
              />
              <button
                onClick={validate}
                disabled={isStreaming || !policy.trim()}
                className={cn("mt-3 w-full rounded-lg py-2.5 text-sm font-medium transition-all", isStreaming || !policy.trim() ? "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed" : "bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90")}
              >
                {isStreaming ? "Validating..." : "Validate Policy"}
              </button>
              {error && <p className="mt-2 text-sm text-aegis-deny">{error}</p>}
            </div>
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {meta && (
              <>
                {/* Score + Compliance */}
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-6 flex-wrap">
                    <ScoreDonut score={meta.score} grade={meta.grade} />
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm font-medium mb-3">Compliance Frameworks</p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {frameworks.map((fw) => {
                          const c = complianceColors[fw.status];
                          return (
                            <div key={fw.key} className={cn("flex flex-col items-center rounded-lg border p-2 text-center", fw.status === "pass" ? "border-aegis-allow/20 bg-aegis-allow/5" : fw.status === "partial" ? "border-aegis-warn/20 bg-aegis-warn/5" : "border-aegis-deny/20 bg-aegis-deny/5")}>
                              <span className="text-[10px] font-bold text-muted-foreground">{fw.label}</span>
                              <span className={cn("mt-1 text-xs font-bold", c.text)}>{c.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Findings */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium mb-3">Security Findings ({meta.findings.length})</p>
                  <div className="space-y-2">
                    {meta.findings.map((f, i) => {
                      const sc = severityColors[f.severity];
                      return (
                        <div key={i} className={cn("rounded-lg border p-3", sc.border, sc.bg)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", sc.text, sc.border, "border")}>{f.severity}</span>
                            <span className="text-sm font-medium">{f.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{f.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* AI Analysis */}
            {(analysis || isStreaming) && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-4 w-4 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span className="text-sm font-medium">AI Security Analysis</span>
                  {isStreaming && <span className="h-2 w-2 animate-pulse rounded-full bg-aegis-cyan" />}
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {analysis || "Analyzing policy..."}
                </div>
              </div>
            )}

            {!meta && !isStreaming && (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                <svg className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <p className="text-sm text-muted-foreground">Paste a policy and click Validate to see security analysis</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Or load an insecure sample to see it in action</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
