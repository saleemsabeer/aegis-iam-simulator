"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VerdictType } from "@/lib/types";

interface SimulationResultsProps {
  verdict: VerdictType | null;
  matchedStatement: unknown | null;
  explanation: string;
  isStreaming: boolean;
}

const verdictConfig: Record<
  VerdictType,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  ALLOW: {
    label: "ALLOW",
    color: "text-aegis-allow",
    bg: "bg-aegis-allow/10",
    border: "border-aegis-allow/30",
    description: "Access is granted by an explicit Allow statement",
  },
  EXPLICIT_DENY: {
    label: "EXPLICIT DENY",
    color: "text-aegis-deny",
    bg: "bg-aegis-deny/10",
    border: "border-aegis-deny/30",
    description: "Access is blocked by an explicit Deny statement",
  },
  IMPLICIT_DENY: {
    label: "IMPLICIT DENY",
    color: "text-aegis-warn",
    bg: "bg-aegis-warn/10",
    border: "border-aegis-warn/30",
    description: "No matching Allow statement found; access denied by default",
  },
};

export function SimulationResults({
  verdict,
  matchedStatement,
  explanation,
  isStreaming,
}: SimulationResultsProps) {
  const [showStatement, setShowStatement] = useState(false);

  if (!verdict) return null;

  const config = verdictConfig[verdict];

  return (
    <div className="space-y-4">
      <Card className={cn("border", config.border, config.bg)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Verdict
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-sm font-bold px-3 py-1 border",
                config.color,
                config.border
              )}
            >
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className={cn("text-sm", config.color)}>{config.description}</p>
        </CardContent>
      </Card>

      {matchedStatement != null && (
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowStatement(!showStatement)}
              className="flex w-full items-center justify-between text-left"
            >
              <CardTitle className="text-sm font-medium">
                Matched Statement
              </CardTitle>
              <svg
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showStatement && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </CardHeader>
          {showStatement && (
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs font-mono text-foreground">
                {JSON.stringify(matchedStatement, null, 2)}
              </pre>
            </CardContent>
          )}
        </Card>
      )}

      {(explanation || isStreaming) && (
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
              AI Analysis
              {isStreaming && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-aegis-cyan" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {explanation || "Analyzing..."}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
