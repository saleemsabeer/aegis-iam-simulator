"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudSelector } from "@/components/CloudSelector";
import { SimulationResults } from "@/components/SimulationResults";
import { evaluateAWSPolicy } from "@/lib/evaluators/aws";
import { evaluateAzurePolicy } from "@/lib/evaluators/azure";
import { evaluateGCPPolicy } from "@/lib/evaluators/gcp";
import { samplePolicies, sampleRequests } from "@/lib/sample-data";
import type {
  CloudProvider,
  AWSPolicy,
  AzureRoleDefinition,
  GCPPolicy,
  VerdictType,
  SimulationResult,
} from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-lg bg-aegis-surface" />
  ),
});

function evaluate(
  cloud: CloudProvider,
  policyStr: string,
  action: string,
  resource: string,
  principal: string
): SimulationResult {
  const parsed = JSON.parse(policyStr);

  switch (cloud) {
    case "aws":
      return evaluateAWSPolicy(parsed as AWSPolicy, action, resource, principal);
    case "azure": {
      const roles: AzureRoleDefinition[] = Array.isArray(parsed)
        ? parsed
        : [parsed];
      return evaluateAzurePolicy(roles, action, resource, principal);
    }
    case "gcp":
      return evaluateGCPPolicy(
        parsed as GCPPolicy,
        action,
        resource,
        principal
      );
  }
}

interface PolicyEditorProps {
  cloud: CloudProvider;
  onCloudChange: (cloud: CloudProvider) => void;
}

export function PolicyEditor({ cloud, onCloudChange }: PolicyEditorProps) {
  const [policy, setPolicy] = useState(samplePolicies[cloud]);
  const [action, setAction] = useState(sampleRequests[cloud].action);
  const [resource, setResource] = useState(sampleRequests[cloud].resource);
  const [principal, setPrincipal] = useState(sampleRequests[cloud].principal);
  const [verdict, setVerdict] = useState<VerdictType | null>(null);
  const [matchedStatement, setMatchedStatement] = useState<unknown | null>(
    null
  );
  const [explanation, setExplanation] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const handleCloudChange = useCallback(
    (newCloud: CloudProvider) => {
      onCloudChange(newCloud);
      setPolicy(samplePolicies[newCloud]);
      setAction(sampleRequests[newCloud].action);
      setResource(sampleRequests[newCloud].resource);
      setPrincipal(sampleRequests[newCloud].principal);
      setVerdict(null);
      setMatchedStatement(null);
      setExplanation("");
      setError("");
    },
    [onCloudChange]
  );

  const loadSample = useCallback(() => {
    setPolicy(samplePolicies[cloud]);
    setAction(sampleRequests[cloud].action);
    setResource(sampleRequests[cloud].resource);
    setPrincipal(sampleRequests[cloud].principal);
    setVerdict(null);
    setExplanation("");
    setError("");
  }, [cloud]);

  const simulate = useCallback(async () => {
    setError("");
    setExplanation("");
    setIsStreaming(false);

    try {
      const result = evaluate(cloud, policy, action, resource, principal);
      setVerdict(result.verdict);
      setMatchedStatement(result.matchedStatement);

      setIsStreaming(true);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloud,
          policy,
          action,
          resource,
          principal,
          verdict: result.verdict,
          matchedStatement: result.matchedStatement,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setExplanation(`Error: ${data.error || "Failed to get AI analysis"}`);
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setExplanation(text);
      }
      setIsStreaming(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed";
      setError(msg);
      setIsStreaming(false);
    }
  }, [cloud, policy, action, resource, principal]);

  const actionLabel =
    cloud === "gcp" ? "Permission" : "Action";
  const actionPlaceholder =
    cloud === "aws"
      ? "e.g. s3:GetObject"
      : cloud === "azure"
        ? "e.g. Microsoft.Storage/storageAccounts/read"
        : "e.g. storage.objects.get";
  const resourcePlaceholder =
    cloud === "aws"
      ? "e.g. arn:aws:s3:::prod-data/*"
      : cloud === "azure"
        ? "e.g. /subscriptions/.../storageAccounts/mystorage"
        : "e.g. projects/my-project/buckets/prod-data";
  const principalPlaceholder =
    cloud === "aws"
      ? "e.g. arn:aws:iam::123456789012:user/analyst"
      : cloud === "azure"
        ? "e.g. user@contoso.com"
        : "e.g. user:analyst@example.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <CloudSelector value={cloud} onChange={handleCloudChange} />
        <Button variant="outline" size="sm" onClick={loadSample}>
          Load Sample
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {cloud === "aws"
                ? "IAM Policy (JSON)"
                : cloud === "azure"
                  ? "Role Definition (JSON)"
                  : "IAM Policy Bindings (JSON)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <MonacoEditor
                height="320px"
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
              Access Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {actionLabel}
              </label>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder={actionPlaceholder}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Resource
              </label>
              <input
                type="text"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                placeholder={resourcePlaceholder}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Principal
              </label>
              <input
                type="text"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder={principalPlaceholder}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button
              onClick={simulate}
              disabled={isStreaming || !policy || !action || !resource || !principal}
              className="w-full bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90"
            >
              {isStreaming ? "Analyzing..." : "Simulate Access"}
            </Button>

            {error && (
              <p className="text-sm text-aegis-deny">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <SimulationResults
        verdict={verdict}
        matchedStatement={matchedStatement}
        explanation={explanation}
        isStreaming={isStreaming}
      />
    </div>
  );
}
