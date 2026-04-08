export type CloudProvider = "aws" | "azure" | "gcp";

export type VerdictType = "ALLOW" | "EXPLICIT_DENY" | "IMPLICIT_DENY";

// ─── AWS ────────────────────────────────────────────────────────────────────

export interface AWSStatement {
  Sid?: string;
  Effect: "Allow" | "Deny";
  Action: string | string[];
  NotAction?: string | string[];
  Resource: string | string[];
  NotResource?: string | string[];
  Condition?: Record<string, Record<string, string | string[]>>;
  Principal?: string | Record<string, string | string[]>;
}

export interface AWSPolicy {
  Version?: string;
  Statement: AWSStatement[];
}

// ─── Azure ──────────────────────────────────────────────────────────────────

export interface AzureRoleDefinition {
  Name: string;
  Description?: string;
  Actions: string[];
  NotActions: string[];
  DataActions?: string[];
  NotDataActions?: string[];
  AssignableScopes: string[];
}

// ─── GCP ────────────────────────────────────────────────────────────────────

export interface GCPBinding {
  role: string;
  members: string[];
  condition?: {
    title: string;
    description?: string;
    expression: string;
  };
}

export interface GCPPolicy {
  bindings: GCPBinding[];
  version?: number;
}

// ─── Simulation ─────────────────────────────────────────────────────────────

export interface SimulationRequest {
  cloud: CloudProvider;
  policy: string;
  action: string;
  resource: string;
  principal: string;
}

export interface SimulationResult {
  verdict: VerdictType;
  matchedStatement: unknown | null;
}

export interface AnalyzeRequest extends SimulationRequest {
  verdict: VerdictType;
  matchedStatement: unknown | null;
}

// ─── Drift ──────────────────────────────────────────────────────────────────

export type DriftSeverity = "critical" | "high" | "medium" | "low";

export interface DriftItem {
  type: "added" | "removed" | "modified";
  path: string;
  baseline?: unknown;
  current?: unknown;
  severity: DriftSeverity;
  description: string;
}

export interface DriftRequest {
  cloud: CloudProvider;
  baseline: string;
  current: string;
}

// ─── Least Privilege ────────────────────────────────────────────────────────

export interface UsageLog {
  action: string;
  timestamp: string;
  count: number;
}

export interface PermissionUsage {
  action: string;
  granted: boolean;
  used: boolean;
  usageCount: number;
  lastUsed?: string;
}

export interface LeastPrivilegeRequest {
  cloud: CloudProvider;
  policy: string;
  logs: UsageLog[];
}

export interface LeastPrivilegeResult {
  score: number;
  totalPermissions: number;
  usedPermissions: number;
  unusedPermissions: number;
  permissions: PermissionUsage[];
}
