"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CloudProvider } from "@/lib/types";

const samplePrompts: Record<CloudProvider, string[]> = {
  aws: [
    "Allow read-only access to S3 bucket prod-data and CloudWatch metrics",
    "Allow a Lambda function to read from DynamoDB table users and write to SQS queue notifications",
    "Deny all S3 delete operations and EC2 terminate actions across all resources",
  ],
  azure: [
    "Allow reading all resources except Key Vault secrets",
    "Grant Contributor access to a specific resource group for the analytics team",
    "Allow managing virtual machines but deny network configuration changes",
  ],
  gcp: [
    "Allow reading Cloud Storage objects and BigQuery tables for a data analyst",
    "Grant a service account permission to manage Compute Engine instances in project my-project",
    "Allow viewing logs and monitoring metrics only, with no write access",
  ],
};

export default function GeneratePage() {
  const [cloud, setCloud] = useState<CloudProvider>("aws");
  const [description, setDescription] = useState("");
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCloudChange = useCallback((c: CloudProvider) => {
    setCloud(c);
    setDescription("");
    setOutput("");
    setError("");
  }, []);

  const generate = useCallback(async () => {
    setError("");
    setOutput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloud, description }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Generation failed");
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setIsStreaming(false); return; }

      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }
      setIsStreaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setIsStreaming(false);
    }
  }, [cloud, description]);

  const copyPolicy = useCallback(() => {
    const jsonMatch = output.match(/```json\n([\s\S]*?)```/);
    const textToCopy = jsonMatch ? jsonMatch[1].trim() : output;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const downloadPolicy = useCallback(() => {
    const jsonMatch = output.match(/```json\n([\s\S]*?)```/);
    const content = jsonMatch ? jsonMatch[1].trim() : output;
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cloud}-policy.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, cloud]);

  // Split output into policy JSON and explanation
  const jsonMatch = output.match(/```json\n([\s\S]*?)```/);
  const policyJson = jsonMatch ? jsonMatch[1].trim() : "";
  const explanation = jsonMatch ? output.slice(output.indexOf("```", output.indexOf("```json") + 7) + 3).trim() : output && !output.includes("```json") ? output : "";

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
            <span className="text-sm text-muted-foreground">Policy Generator</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Simulator</Link>
            <Link href="/validate" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Validator</Link>
            <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Audit</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Cloud selector */}
        <div className="mb-6 flex gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
          {(["aws", "azure", "gcp"] as const).map((c) => (
            <button key={c} onClick={() => handleCloudChange(c)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-all", cloud === c ? "bg-aegis-cyan text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <label className="mb-2 block text-sm font-medium">Describe what the policy should do</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Allow read-only access to S3 bucket prod-data and CloudWatch metrics"
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-background p-4 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-aegis-cyan/50"
              />
              <button
                onClick={generate}
                disabled={isStreaming || !description.trim()}
                className={cn("mt-3 w-full rounded-lg py-2.5 text-sm font-medium transition-all", isStreaming || !description.trim() ? "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed" : "bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90")}
              >
                {isStreaming ? "Generating..." : "Generate Policy"}
              </button>
              {error && <p className="mt-2 text-sm text-aegis-deny">{error}</p>}
            </div>

            {/* Sample prompts */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Sample prompts</p>
              <div className="space-y-2">
                {samplePrompts[cloud].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setDescription(prompt)}
                    className="w-full text-left rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground hover:text-foreground hover:border-aegis-cyan/30 hover:bg-aegis-cyan/5 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Output */}
          <div className="space-y-4">
            {policyJson ? (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-background/50">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-aegis-deny/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-aegis-warn/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-aegis-allow/60" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">{cloud}-policy.json</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={copyPolicy} className="rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={downloadPolicy} className="rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                      Download
                    </button>
                  </div>
                </div>
                <pre className="overflow-x-auto p-4 text-xs font-mono leading-5 text-foreground max-h-[400px] overflow-y-auto">
                  {policyJson}
                </pre>
              </div>
            ) : !isStreaming ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-16 text-center">
                <svg className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm text-muted-foreground">Describe what you need and AI will generate the policy</p>
              </div>
            ) : (
              <div className="rounded-xl border border-aegis-cyan/20 bg-aegis-cyan/5 p-6">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-aegis-cyan border-t-transparent" />
                  <span className="text-sm text-aegis-cyan font-medium">Generating policy...</span>
                </div>
                {output && (
                  <pre className="mt-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap">{output}</pre>
                )}
              </div>
            )}

            {/* Explanation */}
            {explanation && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-4 w-4 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span className="text-sm font-medium">AI Explanation</span>
                  {isStreaming && <span className="h-2 w-2 animate-pulse rounded-full bg-aegis-cyan" />}
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {explanation}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
