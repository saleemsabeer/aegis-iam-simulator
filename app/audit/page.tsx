"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditFinding {
  resource: string;
  resourceType: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  remediation: string;
}

interface ResourceSummary {
  type: string;
  count: number;
  findings: number;
  icon: string;
}

type AuditPhase = "idle" | "connecting" | "scanning" | "analyzing" | "complete";

// ─── Mock Audit Data ─────────────────────────────────────────────────────────

const mockFindings: AuditFinding[] = [
  {
    resource: "arn:aws:iam::123456789012:user/dev-admin",
    resourceType: "IAM User",
    severity: "critical",
    title: "Root-level access with no MFA",
    description: "IAM user dev-admin has AdministratorAccess policy attached with no MFA device configured. This allows unrestricted access to all AWS services and resources.",
    remediation: "Enable MFA for this user immediately. Replace AdministratorAccess with scoped policies following least-privilege principles.",
  },
  {
    resource: "arn:aws:iam::123456789012:role/LambdaFullAccess",
    resourceType: "IAM Role",
    severity: "critical",
    title: "Lambda role with wildcard permissions",
    description: "Role LambdaFullAccess grants Action: * on Resource: *. Lambda functions assuming this role have unrestricted access to the entire AWS account.",
    remediation: "Scope the role down to only the specific actions and resources the Lambda function needs. Use aws:SourceArn condition to restrict which functions can assume this role.",
  },
  {
    resource: "arn:aws:s3:::company-backups",
    resourceType: "S3 Bucket",
    severity: "high",
    title: "S3 bucket allows public read access",
    description: "Bucket policy on company-backups allows s3:GetObject for Principal: *. Backup data is publicly accessible to anyone on the internet.",
    remediation: "Remove the public access policy statement. Enable S3 Block Public Access at the account and bucket level. Use pre-signed URLs for authorized access.",
  },
  {
    resource: "arn:aws:iam::123456789012:policy/LegacyDevPolicy",
    resourceType: "IAM Policy",
    severity: "high",
    title: "Unused policy with broad permissions",
    description: "Policy LegacyDevPolicy has not been used in 180+ days but grants ec2:*, s3:*, and dynamodb:* permissions. Stale policies increase attack surface.",
    remediation: "Delete this unused policy. If still needed, analyze CloudTrail logs to determine actual permission usage and create a scoped replacement.",
  },
  {
    resource: "arn:aws:iam::123456789012:user/ci-deploy",
    resourceType: "IAM User",
    severity: "high",
    title: "Access keys older than 90 days",
    description: "User ci-deploy has active access keys created 247 days ago. Long-lived credentials increase the risk of credential compromise.",
    remediation: "Rotate access keys immediately. Consider switching to IAM roles with temporary credentials for CI/CD pipelines instead of long-lived access keys.",
  },
  {
    resource: "arn:aws:iam::123456789012:group/Developers",
    resourceType: "IAM Group",
    severity: "medium",
    title: "Group with inline policy and managed policies",
    description: "Developers group has both inline policies and 3 managed policies attached. Mixed policy types make permission auditing difficult.",
    remediation: "Consolidate to managed policies only. Remove inline policies and migrate their permissions to a single, well-documented managed policy.",
  },
  {
    resource: "arn:aws:iam::123456789012:role/EC2-SSM-Role",
    resourceType: "IAM Role",
    severity: "medium",
    title: "Role trust policy allows cross-account access",
    description: "EC2-SSM-Role trust policy allows sts:AssumeRole from account 987654321098 without external ID condition.",
    remediation: "Add an ExternalId condition to the trust policy to prevent confused deputy attacks. Verify the cross-account relationship is still required.",
  },
  {
    resource: "arn:aws:lambda:us-east-1:123456789012:function:data-processor",
    resourceType: "Lambda",
    severity: "medium",
    title: "Lambda function with overprivileged execution role",
    description: "Lambda function data-processor uses a role with s3:* and dynamodb:* permissions but CloudTrail shows it only uses s3:GetObject and dynamodb:Query.",
    remediation: "Create a new execution role with only s3:GetObject and dynamodb:Query permissions. Scope resources to specific table and bucket ARNs.",
  },
  {
    resource: "arn:aws:iam::123456789012:user/intern-2024",
    resourceType: "IAM User",
    severity: "low",
    title: "User account with no recent activity",
    description: "User intern-2024 has not logged in or made any API calls in the last 60 days. Dormant accounts are a security risk.",
    remediation: "Disable console access and deactivate access keys for this user. Consider deleting the account if no longer needed.",
  },
  {
    resource: "arn:aws:iam::123456789012:policy/ReadOnlyAudit",
    resourceType: "IAM Policy",
    severity: "low",
    title: "Policy missing resource constraints",
    description: "ReadOnlyAudit policy grants read permissions on Resource: * instead of scoping to specific ARNs.",
    remediation: "Replace Resource: * with specific ARNs for the resources that need to be audited. Use conditions to further restrict access.",
  },
];

const mockResources: ResourceSummary[] = [
  { type: "IAM Users", count: 23, findings: 3, icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
  { type: "IAM Roles", count: 47, findings: 3, icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { type: "IAM Policies", count: 89, findings: 2, icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { type: "IAM Groups", count: 8, findings: 1, icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" },
  { type: "S3 Buckets", count: 34, findings: 1, icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { type: "Lambda Functions", count: 61, findings: 1, icon: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" },
];

const scanMessages = [
  "Connecting to AWS account...",
  "Authenticating with IAM credentials...",
  "Enumerating IAM users...",
  "Scanning IAM roles and trust policies...",
  "Analyzing managed and inline policies...",
  "Checking IAM group memberships...",
  "Auditing S3 bucket policies and ACLs...",
  "Scanning Lambda execution roles...",
  "Evaluating access key age and rotation...",
  "Cross-referencing CloudTrail logs...",
  "Calculating compliance scores...",
  "Generating remediation recommendations...",
  "Finalizing security report...",
];

// ─── Severity config ─────────────────────────────────────────────────────────

const severityColors: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "text-aegis-deny", bg: "bg-aegis-deny/10", border: "border-aegis-deny/30" },
  high: { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" },
  medium: { text: "text-aegis-warn", bg: "bg-aegis-warn/10", border: "border-aegis-warn/30" },
  low: { text: "text-muted-foreground", bg: "bg-muted/20", border: "border-muted-foreground/20" },
};

// ─── Score Donut ─────────────────────────────────────────────────────────────

function ScoreDonut({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f43f5e";

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
      <span className="mt-2 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;
  const totalResources = resources.reduce((sum, r) => sum + r.count, 0);
  const securityScore = Math.max(0, 100 - (criticalCount * 25 + highCount * 12 + mediumCount * 5 + lowCount * 2));

  const filteredFindings = filterSeverity === "all" ? findings : findings.filter((f) => f.severity === filterSeverity);

  const startAudit = useCallback(() => {
    setPhase("connecting");
    setFindings([]);
    setResources([]);
    setScanProgress(0);
    setExpandedFinding(null);

    let messageIdx = 0;
    let progress = 0;

    setTimeout(() => {
      setPhase("scanning");
      setCurrentMessage(scanMessages[0]);

      timerRef.current = setInterval(() => {
        progress += Math.random() * 4 + 1;
        if (progress >= 100) progress = 100;
        setScanProgress(Math.min(Math.floor(progress), 100));

        messageIdx = Math.min(
          Math.floor((progress / 100) * scanMessages.length),
          scanMessages.length - 1
        );
        setCurrentMessage(scanMessages[messageIdx]);

        if (progress >= 100) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("analyzing");
          setCurrentMessage("AI analyzing findings and generating recommendations...");

          setTimeout(() => {
            setFindings(mockFindings);
            setResources(mockResources);
            setPhase("complete");
          }, 2000);
        }
      }, 300);
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
            <span className="text-sm text-muted-foreground">Infrastructure Audit</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Simulator</Link>
            <Link href="/generate" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Generator</Link>
            <Link href="/validate" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Validator</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Idle state / Start audit */}
        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-aegis-cyan/10 border border-aegis-cyan/20">
              <svg className="h-10 w-10 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-3">Infrastructure Audit</h1>
            <p className="text-muted-foreground max-w-md text-center mb-8">
              Autonomously scan your AWS account for IAM misconfigurations, overprivileged roles, public resources, and compliance violations.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={startAudit}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-aegis-cyan px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:bg-aegis-cyan/90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                Run Demo Audit
              </button>
              <Link
                href="/setup"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 px-8 py-3 text-sm font-medium text-foreground transition-all hover:bg-secondary/60"
              >
                Configure AWS Access
              </Link>
            </div>

            {/* Feature preview cards */}
            <div className="mt-16 grid gap-4 sm:grid-cols-3 max-w-2xl w-full">
              {[
                { title: "IAM Analysis", desc: "Users, roles, policies, and groups", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
                { title: "Resource Scan", desc: "S3, Lambda, and more", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75" },
                { title: "AI Remediation", desc: "Fix recommendations per finding", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-4 text-center">
                  <svg className="mx-auto mb-2 h-6 w-6 text-aegis-cyan/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scanning state */}
        {(phase === "connecting" || phase === "scanning" || phase === "analyzing") && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-8 relative">
              <div className="h-24 w-24 rounded-full border-4 border-aegis-cyan/20 flex items-center justify-center">
                <div className="h-20 w-20 rounded-full border-4 border-aegis-cyan border-t-transparent animate-spin" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-aegis-cyan">{scanProgress}%</span>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-2">
              {phase === "connecting" ? "Connecting..." : phase === "analyzing" ? "Analyzing..." : "Scanning..."}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{currentMessage}</p>

            {/* Progress bar */}
            <div className="w-full max-w-md">
              <div className="h-2 rounded-full bg-secondary/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-aegis-cyan transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {phase === "complete" && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold">Audit Results</h1>
                <p className="text-sm text-muted-foreground">
                  Scanned {totalResources} resources across {resources.length} categories
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPhase("idle");
                    setFindings([]);
                    setResources([]);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all"
                >
                  New Audit
                </button>
                <button
                  onClick={startAudit}
                  className="rounded-lg bg-aegis-cyan px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-aegis-cyan/90 transition-all"
                >
                  Re-scan
                </button>
              </div>
            </div>

            {/* Score cards row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                <ScoreDonut score={securityScore} label="Security" size={80} />
                <div>
                  <p className="text-sm font-medium">Security Score</p>
                  <p className="text-xs text-muted-foreground">
                    {securityScore >= 80 ? "Good posture" : securityScore >= 50 ? "Needs attention" : "Critical risk"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground mb-2">Total Findings</p>
                <p className="text-3xl font-bold">{findings.length}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {criticalCount > 0 && <span className="rounded-full bg-aegis-deny/10 border border-aegis-deny/30 px-2 py-0.5 text-[10px] font-bold text-aegis-deny">{criticalCount} CRITICAL</span>}
                  {highCount > 0 && <span className="rounded-full bg-orange-400/10 border border-orange-400/30 px-2 py-0.5 text-[10px] font-bold text-orange-400">{highCount} HIGH</span>}
                  {mediumCount > 0 && <span className="rounded-full bg-aegis-warn/10 border border-aegis-warn/30 px-2 py-0.5 text-[10px] font-bold text-aegis-warn">{mediumCount} MED</span>}
                  {lowCount > 0 && <span className="rounded-full bg-muted/20 border border-muted-foreground/20 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{lowCount} LOW</span>}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground mb-2">Resources Scanned</p>
                <p className="text-3xl font-bold">{totalResources}</p>
                <p className="mt-2 text-xs text-muted-foreground">{resources.length} resource types</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground mb-2">Compliance</p>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {[
                    { label: "PCI", pass: criticalCount === 0 && highCount === 0 },
                    { label: "HIPAA", pass: criticalCount === 0 },
                    { label: "SOX", pass: criticalCount === 0 },
                    { label: "GDPR", pass: criticalCount === 0 },
                    { label: "CIS", pass: criticalCount === 0 && highCount === 0 },
                    { label: "NIST", pass: criticalCount === 0 },
                  ].map((fw) => (
                    <div key={fw.label} className={cn("rounded px-1.5 py-1 text-center text-[10px] font-bold border", fw.pass ? "text-aegis-allow border-aegis-allow/20 bg-aegis-allow/5" : "text-aegis-deny border-aegis-deny/20 bg-aegis-deny/5")}>
                      {fw.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Resource breakdown */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-3">Resource Breakdown</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r) => (
                  <div key={r.type} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3">
                    <svg className="h-5 w-5 text-aegis-cyan/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={r.icon} />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.type}</p>
                      <p className="text-xs text-muted-foreground">{r.count} scanned</p>
                    </div>
                    {r.findings > 0 ? (
                      <span className="rounded-full bg-aegis-deny/10 border border-aegis-deny/30 px-2 py-0.5 text-[10px] font-bold text-aegis-deny shrink-0">
                        {r.findings} issues
                      </span>
                    ) : (
                      <span className="rounded-full bg-aegis-allow/10 border border-aegis-allow/30 px-2 py-0.5 text-[10px] font-bold text-aegis-allow shrink-0">
                        Clean
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Findings */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-sm font-medium">Security Findings ({findings.length})</p>
                <div className="flex gap-1 rounded-lg bg-secondary/50 p-0.5">
                  {["all", "critical", "high", "medium", "low"].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setFilterSeverity(sev)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all capitalize",
                        filterSeverity === sev
                          ? "bg-aegis-cyan text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredFindings.map((f, i) => {
                  const sc = severityColors[f.severity];
                  const isExpanded = expandedFinding === i;
                  return (
                    <div key={i} className={cn("rounded-lg border transition-all", sc.border, sc.bg)}>
                      <button
                        onClick={() => setExpandedFinding(isExpanded ? null : i)}
                        className="w-full text-left p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0 mt-0.5 border", sc.text, sc.border)}>{f.severity}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{f.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.resource}</p>
                          </div>
                          <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">{f.resourceType}</span>
                          <svg className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/30 px-3 pb-3 pt-2 space-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-aegis-cyan uppercase tracking-wider mb-1">Remediation</p>
                            <p className="text-xs text-foreground/80 leading-relaxed">{f.remediation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Resource ARN</p>
                            <code className="text-[11px] font-mono text-muted-foreground break-all">{f.resource}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
