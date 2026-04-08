"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudSelector } from "@/components/CloudSelector";
import { cn } from "@/lib/utils";
import { samplePolicies, sampleLogs } from "@/lib/sample-data";
import type { CloudProvider, LeastPrivilegeResult, PermissionUsage } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] animate-pulse rounded-lg bg-aegis-surface" />
  ),
});

// ─── Score Donut ─────────────────────────────────────────────────────────────

function ScoreDonut({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? "#34d399"
      : score >= 50
        ? "#fbbf24"
        : "#f43f5e";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ─── Permission Row ──────────────────────────────────────────────────────────

function PermissionRow({ perm }: { perm: PermissionUsage }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border px-3 py-2",
        perm.used
          ? "border-aegis-allow/20 bg-aegis-allow/5"
          : "border-aegis-deny/20 bg-aegis-deny/5"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-mono">{perm.action}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {perm.usageCount > 0 ? `${perm.usageCount} calls` : "0 calls"}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            perm.used
              ? "text-aegis-allow border-aegis-allow/30"
              : "text-aegis-deny border-aegis-deny/30"
          )}
        >
          {perm.used ? "USED" : "UNUSED"}
        </Badge>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface LeastPrivilegeAnalyzerProps {
  cloud: CloudProvider;
  onCloudChange: (cloud: CloudProvider) => void;
}

export function LeastPrivilegeAnalyzer({
  cloud,
  onCloudChange,
}: LeastPrivilegeAnalyzerProps) {
  const [policy, setPolicy] = useState(samplePolicies[cloud]);
  const [logs, setLogs] = useState(JSON.stringify(sampleLogs[cloud], null, 2));
  const [result, setResult] = useState<LeastPrivilegeResult | null>(null);
  const [recommendations, setRecommendations] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const handleCloudChange = useCallback(
    (newCloud: CloudProvider) => {
      onCloudChange(newCloud);
      setPolicy(samplePolicies[newCloud]);
      setLogs(JSON.stringify(sampleLogs[newCloud], null, 2));
      setResult(null);
      setRecommendations("");
      setError("");
    },
    [onCloudChange]
  );

  const loadSample = useCallback(() => {
    setPolicy(samplePolicies[cloud]);
    setLogs(JSON.stringify(sampleLogs[cloud], null, 2));
    setResult(null);
    setRecommendations("");
    setError("");
  }, [cloud]);

  const analyze = useCallback(async () => {
    setError("");
    setResult(null);
    setRecommendations("");
    setIsStreaming(true);

    try {
      let parsedLogs;
      try {
        parsedLogs = JSON.parse(logs);
      } catch {
        setError("Invalid JSON in usage logs");
        setIsStreaming(false);
        return;
      }

      const response = await fetch("/api/least-privilege", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloud, policy, logs: parsedLogs }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Analysis failed");
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let text = "";
      let metaParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });

        if (!metaParsed && text.includes(":END_META-->")) {
          const metaMatch = text.match(
            /<!--LP_META:(.*?):END_META-->/s
          );
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1]) as LeastPrivilegeResult;
              setResult(meta);
            } catch {
              // meta parse failed
            }
            text = text.replace(/<!--LP_META:.*?:END_META-->\n?/s, "");
            metaParsed = true;
          }
        }

        if (metaParsed) {
          setRecommendations(text);
        }
      }

      setIsStreaming(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
      setIsStreaming(false);
    }
  }, [cloud, policy, logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <CloudSelector value={cloud} onChange={handleCloudChange} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSample}>
            Load Sample
          </Button>
          <Button
            size="sm"
            onClick={analyze}
            disabled={isStreaming || !policy || !logs}
            className="bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90"
          >
            {isStreaming ? "Analyzing..." : "Analyze Privileges"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Policy (JSON)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <MonacoEditor
                height="250px"
                defaultLanguage="json"
                value={policy}
                onChange={(v) => setPolicy(v ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                  wordWrap: "on",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Usage Logs (JSON array)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <MonacoEditor
                height="250px"
                defaultLanguage="json"
                value={logs}
                onChange={(v) => setLogs(v ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                  wordWrap: "on",
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-aegis-deny">{error}</p>}

      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="flex flex-col items-center justify-center py-6">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Least-Privilege Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDonut score={result.score} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>
                  Permission Usage ({result.totalPermissions} permissions)
                </span>
                <div className="flex gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-aegis-allow border-aegis-allow/30"
                  >
                    {result.usedPermissions} used
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-aegis-deny border-aegis-deny/30"
                  >
                    {result.unusedPermissions} unused
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {result.permissions.map((perm, i) => (
                  <PermissionRow key={i} perm={perm} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(recommendations || isStreaming) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <svg
                className="h-4 w-4 text-aegis-cyan"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
              AI Recommendations
              {isStreaming && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-aegis-cyan" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {recommendations || "Generating recommendations..."}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
