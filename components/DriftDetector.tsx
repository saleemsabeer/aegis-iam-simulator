"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudSelector } from "@/components/CloudSelector";
import { cn } from "@/lib/utils";
import {
  sampleDriftBaseline,
  sampleDriftCurrent,
} from "@/lib/sample-data";
import type { CloudProvider, DriftItem, DriftSeverity } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] animate-pulse rounded-lg bg-aegis-surface" />
  ),
});

const severityConfig: Record<
  DriftSeverity,
  { label: string; color: string; bg: string; border: string }
> = {
  critical: {
    label: "CRITICAL",
    color: "text-aegis-deny",
    bg: "bg-aegis-deny/10",
    border: "border-aegis-deny/30",
  },
  high: {
    label: "HIGH",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
  },
  medium: {
    label: "MEDIUM",
    color: "text-aegis-warn",
    bg: "bg-aegis-warn/10",
    border: "border-aegis-warn/30",
  },
  low: {
    label: "LOW",
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-muted-foreground/20",
  },
};

interface DriftDetectorProps {
  cloud: CloudProvider;
  onCloudChange: (cloud: CloudProvider) => void;
}

export function DriftDetector({ cloud, onCloudChange }: DriftDetectorProps) {
  const [baseline, setBaseline] = useState(sampleDriftBaseline[cloud]);
  const [current, setCurrent] = useState(sampleDriftCurrent[cloud]);
  const [driftItems, setDriftItems] = useState<DriftItem[]>([]);
  const [commentary, setCommentary] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const handleCloudChange = useCallback(
    (newCloud: CloudProvider) => {
      onCloudChange(newCloud);
      setBaseline(sampleDriftBaseline[newCloud]);
      setCurrent(sampleDriftCurrent[newCloud]);
      setDriftItems([]);
      setCommentary("");
      setError("");
    },
    [onCloudChange]
  );

  const loadSample = useCallback(() => {
    setBaseline(sampleDriftBaseline[cloud]);
    setCurrent(sampleDriftCurrent[cloud]);
    setDriftItems([]);
    setCommentary("");
    setError("");
  }, [cloud]);

  const detectDrift = useCallback(async () => {
    setError("");
    setDriftItems([]);
    setCommentary("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloud, baseline, current }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to detect drift");
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
            /<!--DRIFT_META:(.*?):END_META-->/s
          );
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1]);
              setDriftItems(meta.items ?? []);
            } catch {
              // meta parse failed, continue
            }
            text = text.replace(/<!--DRIFT_META:.*?:END_META-->\n?/s, "");
            metaParsed = true;
          }
        }

        if (metaParsed) {
          setCommentary(text);
        }
      }

      setIsStreaming(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Drift detection failed";
      setError(msg);
      setIsStreaming(false);
    }
  }, [cloud, baseline, current]);

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
            onClick={detectDrift}
            disabled={isStreaming || !baseline || !current}
            className="bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90"
          >
            {isStreaming ? "Analyzing..." : "Detect Drift"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Baseline Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <MonacoEditor
                height="280px"
                defaultLanguage="json"
                value={baseline}
                onChange={(v) => setBaseline(v ?? "")}
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
              Current Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <MonacoEditor
                height="280px"
                defaultLanguage="json"
                value={current}
                onChange={(v) => setCurrent(v ?? "")}
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

      {driftItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>Drift Items ({driftItems.length} changes)</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  driftItems.some((i) => i.severity === "critical")
                    ? "text-aegis-deny border-aegis-deny/30"
                    : driftItems.some((i) => i.severity === "high")
                      ? "text-orange-400 border-orange-400/30"
                      : "text-aegis-warn border-aegis-warn/30"
                )}
              >
                {driftItems.some((i) => i.severity === "critical")
                  ? "CRITICAL"
                  : driftItems.some((i) => i.severity === "high")
                    ? "HIGH RISK"
                    : "MEDIUM RISK"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {driftItems.map((item, i) => {
                const config = severityConfig[item.severity];
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3",
                      config.border,
                      config.bg
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-0.5 shrink-0 text-[10px]",
                        config.color,
                        config.border
                      )}
                    >
                      {config.label}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate">
                        {item.path}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-auto shrink-0 text-[10px] text-muted-foreground"
                    >
                      {item.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(commentary || isStreaming) && (
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
              AI Risk Analysis
              {isStreaming && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-aegis-cyan" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {commentary || "Analyzing drift..."}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
