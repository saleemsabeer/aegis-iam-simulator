"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type CredentialStatus = "idle" | "checking" | "found" | "not-found";

interface SetupState {
  step: number;
  credentialStatus: CredentialStatus;
  region: string;
  accessKeyPreview: string;
  scanTargets: {
    users: boolean;
    roles: boolean;
    policies: boolean;
    groups: boolean;
    buckets: boolean;
    lambdas: boolean;
  };
  scanStatus: "idle" | "scanning" | "done";
  scanProgress: number;
}

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU (Ireland)" },
  { value: "eu-west-2", label: "EU (London)" },
  { value: "eu-central-1", label: "EU (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "sa-east-1", label: "South America (Sao Paulo)" },
];

const STEPS = [
  { number: 1, label: "Authenticate" },
  { number: 2, label: "Configure Scan" },
  { number: 3, label: "Review & Launch" },
];

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                current > step.number
                  ? "bg-aegis-cyan text-primary-foreground"
                  : current === step.number
                    ? "bg-aegis-cyan/20 text-aegis-cyan border border-aegis-cyan/40"
                    : "bg-secondary/50 text-muted-foreground border border-border"
              )}
            >
              {current > step.number ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={cn(
                "hidden text-sm font-medium sm:block transition-colors",
                current >= step.number ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="hidden sm:block w-12 h-px bg-border relative">
              <div
                className="absolute inset-y-0 left-0 bg-aegis-cyan transition-all duration-500"
                style={{ width: current > step.number ? "100%" : "0%" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-aegis-cyan to-[#67e8f9] transition-all duration-500 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ─── Step 1: Authentication ──────────────────────────────────────────────────

function StepAuthenticate({
  state,
  onCheckCredentials,
  onRegionChange,
}: {
  state: SetupState;
  onCheckCredentials: () => void;
  onRegionChange: (region: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">AWS Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Connect your AWS account to scan IAM policies and audit your infrastructure.
        </p>
      </div>

      {/* Credential status */}
      <div
        className={cn(
          "rounded-xl border p-5 transition-all duration-300",
          state.credentialStatus === "found"
            ? "border-aegis-allow/30 bg-aegis-allow/5"
            : state.credentialStatus === "not-found"
              ? "border-aegis-warn/30 bg-aegis-warn/5"
              : "border-border bg-secondary/20"
        )}
      >
        <div className="flex items-start gap-3">
          {state.credentialStatus === "idle" && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/50 border border-border">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
          )}
          {state.credentialStatus === "checking" && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aegis-cyan/10 border border-aegis-cyan/20">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-aegis-cyan border-t-transparent" />
            </div>
          )}
          {state.credentialStatus === "found" && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aegis-allow/10 border border-aegis-allow/20">
              <svg className="h-4 w-4 text-aegis-allow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          {state.credentialStatus === "not-found" && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aegis-warn/10 border border-aegis-warn/20">
              <svg className="h-4 w-4 text-aegis-warn" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {state.credentialStatus === "idle" && (
              <>
                <p className="font-medium text-sm">AWS Credentials</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click below to detect credentials from your environment
                </p>
              </>
            )}
            {state.credentialStatus === "checking" && (
              <>
                <p className="font-medium text-sm text-aegis-cyan">Scanning for credentials...</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Checking ~/.aws/credentials, environment variables, and EC2 metadata
                </p>
              </>
            )}
            {state.credentialStatus === "found" && (
              <>
                <p className="font-medium text-sm text-aegis-allow">Credentials Found</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Access Key:</span>
                  <code className="rounded bg-background/50 px-2 py-0.5 text-xs font-mono text-foreground">
                    {state.accessKeyPreview}
                  </code>
                </div>
              </>
            )}
            {state.credentialStatus === "not-found" && (
              <>
                <p className="font-medium text-sm text-aegis-warn">No Credentials Found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure AWS CLI first to connect your account
                </p>
                <div className="mt-3 rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Setup AWS CLI:</p>
                  <div className="font-mono text-xs space-y-1">
                    <p><span className="text-aegis-cyan">$</span> <span className="text-foreground">pip install awscli</span></p>
                    <p><span className="text-aegis-cyan">$</span> <span className="text-foreground">aws configure</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {(state.credentialStatus === "idle" || state.credentialStatus === "not-found") && (
          <button
            onClick={onCheckCredentials}
            className={cn(
              "mt-4 w-full rounded-lg py-2.5 text-sm font-medium transition-all",
              state.credentialStatus === "not-found"
                ? "bg-aegis-warn/10 text-aegis-warn border border-aegis-warn/30 hover:bg-aegis-warn/20"
                : "bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90"
            )}
          >
            {state.credentialStatus === "not-found" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Try Again / Refresh
              </span>
            ) : (
              "Detect Credentials"
            )}
          </button>
        )}
      </div>

      {/* Region selector */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          AWS Region
        </label>
        <div className="relative">
          <select
            value={state.region}
            onChange={(e) => onRegionChange(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-aegis-cyan/50 focus:border-aegis-cyan/50 transition-all"
          >
            {AWS_REGIONS.map((r) => (
              <option key={r.value} value={r.value} className="bg-card">
                {r.value} - {r.label}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Manual entry option */}
      <div className="rounded-xl border border-border/50 bg-secondary/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground">Or enter credentials manually</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Access Key ID"
            className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-aegis-cyan/50"
          />
          <input
            type="password"
            placeholder="Secret Access Key"
            className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-aegis-cyan/50"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Configure Scan ──────────────────────────────────────────────────

function StepConfigureScan({
  state,
  onToggleTarget,
}: {
  state: SetupState;
  onToggleTarget: (key: keyof SetupState["scanTargets"]) => void;
}) {
  const targets: {
    key: keyof SetupState["scanTargets"];
    label: string;
    description: string;
    icon: React.ReactNode;
    count: string;
  }[] = [
    {
      key: "users",
      label: "IAM Users",
      description: "Scan user policies, access keys, and MFA status",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      count: "~24 users",
    },
    {
      key: "roles",
      label: "IAM Roles",
      description: "Analyze role trust policies and permission boundaries",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
      count: "~38 roles",
    },
    {
      key: "policies",
      label: "IAM Policies",
      description: "Evaluate inline and managed policies for overprivilege",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      count: "~67 policies",
    },
    {
      key: "groups",
      label: "IAM Groups",
      description: "Check group memberships and attached policies",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      count: "~8 groups",
    },
    {
      key: "buckets",
      label: "S3 Bucket Policies",
      description: "Scan bucket policies and ACLs for public access",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
      count: "~15 buckets",
    },
    {
      key: "lambdas",
      label: "Lambda Execution Roles",
      description: "Audit Lambda function roles for least privilege",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      ),
      count: "~31 functions",
    },
  ];

  const selectedCount = Object.values(state.scanTargets).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Configure Scan</h2>
        <p className="text-sm text-muted-foreground">
          Select which IAM resources to scan in{" "}
          <code className="rounded bg-secondary/50 px-1.5 py-0.5 text-xs font-mono text-aegis-cyan">
            {state.region}
          </code>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {targets.map((target) => {
          const active = state.scanTargets[target.key];
          return (
            <button
              key={target.key}
              onClick={() => onToggleTarget(target.key)}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                active
                  ? "border-aegis-cyan/30 bg-aegis-cyan/5 hover:bg-aegis-cyan/10"
                  : "border-border bg-secondary/10 hover:bg-secondary/20 hover:border-border/80"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                  active
                    ? "bg-aegis-cyan/10 border-aegis-cyan/30 text-aegis-cyan"
                    : "bg-secondary/30 border-border text-muted-foreground"
                )}
              >
                {target.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{target.label}</p>
                  <div
                    className={cn(
                      "h-4 w-4 rounded border transition-all flex items-center justify-center",
                      active
                        ? "bg-aegis-cyan border-aegis-cyan"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {active && (
                      <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{target.description}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{target.count}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/10 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {selectedCount} of {targets.length} resource types selected
        </span>
        <button
          onClick={() => targets.forEach((t) => !state.scanTargets[t.key] && onToggleTarget(t.key))}
          className="text-xs font-medium text-aegis-cyan hover:text-aegis-cyan/80 transition-colors"
        >
          Select All
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Review & Launch ─────────────────────────────────────────────────

function StepReview({
  state,
  onStartScan,
}: {
  state: SetupState;
  onStartScan: () => void;
}) {
  const selectedTargets = Object.entries(state.scanTargets)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const targetLabels: Record<string, string> = {
    users: "IAM Users",
    roles: "IAM Roles",
    policies: "IAM Policies",
    groups: "IAM Groups",
    buckets: "S3 Bucket Policies",
    lambdas: "Lambda Execution Roles",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Review & Launch</h2>
        <p className="text-sm text-muted-foreground">
          Confirm your scan configuration before launching the audit.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary/10 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Account</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Access Key</span>
              <code className="text-sm font-mono text-foreground">{state.accessKeyPreview}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Region</span>
              <code className="text-sm font-mono text-aegis-cyan">{state.region}</code>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/10 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Scan Scope</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTargets.map((key) => (
              <span
                key={key}
                className="rounded-md border border-aegis-cyan/20 bg-aegis-cyan/5 px-2 py-0.5 text-xs font-medium text-aegis-cyan"
              >
                {targetLabels[key]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Scan status */}
      {state.scanStatus === "idle" && (
        <div className="rounded-xl border border-border/50 bg-secondary/10 p-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-aegis-cyan/10 border border-aegis-cyan/20 mb-4">
            <svg className="h-7 w-7 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1">Ready to scan</p>
          <p className="text-xs text-muted-foreground mb-5">
            Aegis will analyze {selectedTargets.length} resource types in {state.region}
          </p>
          <button
            onClick={onStartScan}
            className="inline-flex items-center gap-2 rounded-xl bg-aegis-cyan px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-aegis-cyan/90 hover:shadow-[0_0_30px_rgba(34,211,238,0.25)] transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
            Start Audit
          </button>
        </div>
      )}

      {state.scanStatus === "scanning" && (
        <div className="rounded-xl border border-aegis-cyan/20 bg-aegis-cyan/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-aegis-cyan border-t-transparent" />
            <p className="text-sm font-medium text-aegis-cyan">Scanning infrastructure...</p>
            <span className="ml-auto text-sm font-mono text-aegis-cyan tabular-nums">{state.scanProgress}%</span>
          </div>
          <ProgressBar value={state.scanProgress} />
          <div className="mt-4 space-y-1.5 font-mono text-xs text-muted-foreground">
            {state.scanProgress > 5 && <p className="animate-[fade-in_0.3s]"><span className="text-aegis-allow mr-2">✓</span>Connected to AWS API</p>}
            {state.scanProgress > 20 && <p className="animate-[fade-in_0.3s]"><span className="text-aegis-allow mr-2">✓</span>Enumerating IAM users and roles</p>}
            {state.scanProgress > 45 && <p className="animate-[fade-in_0.3s]"><span className="text-aegis-allow mr-2">✓</span>Analyzing attached policies</p>}
            {state.scanProgress > 65 && <p className="animate-[fade-in_0.3s]"><span className="text-aegis-cyan mr-2">⟳</span>Evaluating least-privilege compliance</p>}
            {state.scanProgress > 85 && <p className="animate-[fade-in_0.3s]"><span className="text-aegis-cyan mr-2">⟳</span>Generating AI risk assessment</p>}
          </div>
        </div>
      )}

      {state.scanStatus === "done" && (
        <div className="rounded-xl border border-aegis-allow/20 bg-aegis-allow/5 p-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-aegis-allow/10 border border-aegis-allow/20 mb-4">
            <svg className="h-7 w-7 text-aegis-allow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-aegis-allow mb-1">Audit Complete</p>
          <p className="text-xs text-muted-foreground mb-5">
            Found 12 findings across {selectedTargets.length} resource types. 3 critical, 5 high, 4 medium.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-aegis-cyan px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-aegis-cyan/90 transition-all"
          >
            View Results in Simulator
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Main Setup Page ─────────────────────────────────────────────────────────

export default function SetupPage() {
  const [state, setState] = useState<SetupState>({
    step: 1,
    credentialStatus: "idle",
    region: "us-east-1",
    accessKeyPreview: "",
    scanTargets: {
      users: true,
      roles: true,
      policies: true,
      groups: true,
      buckets: false,
      lambdas: false,
    },
    scanStatus: "idle",
    scanProgress: 0,
  });

  const progress = ((state.step - 1) / (STEPS.length)) * 100 +
    (state.step === 3 && state.scanStatus === "done" ? 33.3 : 0);

  const checkCredentials = useCallback(() => {
    setState((s) => ({ ...s, credentialStatus: "checking" }));
    setTimeout(() => {
      // Simulate finding credentials
      const found = Math.random() > 0.4;
      setState((s) => ({
        ...s,
        credentialStatus: found ? "found" : "not-found",
        accessKeyPreview: found ? "AKIA****EXAMPLE" : "",
      }));
    }, 2000);
  }, []);

  const toggleTarget = useCallback((key: keyof SetupState["scanTargets"]) => {
    setState((s) => ({
      ...s,
      scanTargets: { ...s.scanTargets, [key]: !s.scanTargets[key] },
    }));
  }, []);

  const startScan = useCallback(() => {
    setState((s) => ({ ...s, scanStatus: "scanning", scanProgress: 0 }));
  }, []);

  // Simulate scan progress
  useEffect(() => {
    if (state.scanStatus !== "scanning") return;
    const timer = setInterval(() => {
      setState((s) => {
        const next = s.scanProgress + Math.random() * 4 + 1;
        if (next >= 100) {
          clearInterval(timer);
          return { ...s, scanProgress: 100, scanStatus: "done" };
        }
        return { ...s, scanProgress: Math.floor(next) };
      });
    }, 150);
    return () => clearInterval(timer);
  }, [state.scanStatus]);

  const canAdvance =
    (state.step === 1 && state.credentialStatus === "found") ||
    (state.step === 2 && Object.values(state.scanTargets).some(Boolean)) ||
    state.step === 3;

  const nextStep = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, 3) }));
  const prevStep = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 1) }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 dot-grid animate-grid-pulse" />
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-aegis-cyan/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[#a78bfa]/[0.03] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/demo" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-aegis-cyan/10 border border-aegis-cyan/20">
              <svg className="h-3.5 w-3.5 text-aegis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-sm font-semibold">Aegis Setup</span>
          </Link>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip to Simulator
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-start justify-center pt-8 pb-20 px-6 sm:pt-12">
        <div className="w-full max-w-2xl">
          {/* Step indicator */}
          <div className="mb-8 flex justify-center">
            <StepIndicator current={state.step} total={STEPS.length} />
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Step {state.step} of {STEPS.length}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/20">
            {state.step === 1 && (
              <StepAuthenticate
                state={state}
                onCheckCredentials={checkCredentials}
                onRegionChange={(r) => setState((s) => ({ ...s, region: r }))}
              />
            )}
            {state.step === 2 && (
              <StepConfigureScan state={state} onToggleTarget={toggleTarget} />
            )}
            {state.step === 3 && (
              <StepReview state={state} onStartScan={startScan} />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={state.step === 1}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                state.step === 1
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
              )}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Previous
            </button>

            {state.step < 3 && (
              <button
                onClick={nextStep}
                disabled={!canAdvance}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
                  canAdvance
                    ? "bg-aegis-cyan text-primary-foreground hover:bg-aegis-cyan/90"
                    : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                Continue
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
