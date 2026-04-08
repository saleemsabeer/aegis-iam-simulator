import { streamText } from "ai";
import { model } from "@/lib/anthropic";
import type {
  CloudProvider,
  LeastPrivilegeResult,
  PermissionUsage,
  UsageLog,
} from "@/lib/types";

export const runtime = "edge";

function cloudLabel(cloud: CloudProvider): string {
  return { aws: "AWS IAM", azure: "Azure RBAC", gcp: "GCP IAM" }[cloud];
}

function extractPermissionsFromPolicy(
  cloud: CloudProvider,
  policyObj: unknown
): string[] {
  const permissions: string[] = [];

  if (cloud === "aws") {
    const policy = policyObj as { Statement?: { Effect?: string; Action?: string | string[]; NotAction?: string | string[] }[] };
    for (const stmt of policy.Statement ?? []) {
      if (stmt.Effect !== "Allow") continue;
      if (stmt.NotAction) continue;
      const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      for (const a of actions) {
        if (a && !a.includes("*")) permissions.push(a);
      }
    }
  }

  if (cloud === "azure") {
    const roles = (Array.isArray(policyObj) ? policyObj : [policyObj]) as {
      Actions?: string[];
      DataActions?: string[];
    }[];
    for (const role of roles) {
      for (const a of role.Actions ?? []) {
        if (!a.includes("*")) permissions.push(a);
      }
      for (const a of role.DataActions ?? []) {
        if (!a.includes("*")) permissions.push(a);
      }
    }
  }

  if (cloud === "gcp") {
    const GCP_ROLE_PERMS: Record<string, string[]> = {
      "roles/storage.objectViewer": ["storage.objects.get", "storage.objects.list", "storage.buckets.get", "storage.buckets.list"],
      "roles/storage.objectAdmin": ["storage.objects.get", "storage.objects.list", "storage.objects.create", "storage.objects.delete", "storage.objects.update", "storage.buckets.get", "storage.buckets.list"],
      "roles/storage.admin": ["storage.objects.get", "storage.objects.list", "storage.objects.create", "storage.objects.delete", "storage.objects.update", "storage.buckets.get", "storage.buckets.list", "storage.buckets.create", "storage.buckets.delete", "storage.buckets.update"],
      "roles/bigquery.dataViewer": ["bigquery.datasets.get", "bigquery.tables.get", "bigquery.tables.list", "bigquery.tables.getData"],
      "roles/bigquery.dataEditor": ["bigquery.datasets.get", "bigquery.tables.get", "bigquery.tables.list", "bigquery.tables.getData", "bigquery.tables.create", "bigquery.tables.update", "bigquery.tables.delete", "bigquery.tables.updateData"],
      "roles/compute.viewer": ["compute.instances.get", "compute.instances.list", "compute.networks.get", "compute.networks.list"],
      "roles/logging.viewer": ["logging.logEntries.list", "logging.logs.list", "logging.logServices.list", "logging.sinks.get", "logging.sinks.list"],
    };
    const policy = policyObj as { bindings?: { role?: string }[] };
    for (const binding of policy.bindings ?? []) {
      const perms = GCP_ROLE_PERMS[binding.role ?? ""];
      if (perms) permissions.push(...perms);
    }
  }

  return [...new Set(permissions)];
}

function analyzeUsage(
  grantedPermissions: string[],
  logs: UsageLog[]
): LeastPrivilegeResult {
  const logMap = new Map<string, UsageLog>();
  for (const log of logs) {
    const existing = logMap.get(log.action);
    if (!existing || log.count > existing.count) {
      logMap.set(log.action, log);
    }
  }

  const permissions: PermissionUsage[] = grantedPermissions.map((action) => {
    const log = logMap.get(action);
    return {
      action,
      granted: true,
      used: !!log,
      usageCount: log?.count ?? 0,
      lastUsed: log?.timestamp,
    };
  });

  const usedPermissions = permissions.filter((p) => p.used).length;
  const totalPermissions = permissions.length;
  const unusedPermissions = totalPermissions - usedPermissions;
  const score =
    totalPermissions > 0
      ? Math.round((usedPermissions / totalPermissions) * 100)
      : 100;

  permissions.sort((a, b) => {
    if (a.used !== b.used) return a.used ? 1 : -1;
    return b.usageCount - a.usageCount;
  });

  return {
    score,
    totalPermissions,
    usedPermissions,
    unusedPermissions,
    permissions,
  };
}

export async function POST(req: Request) {
  try {
    const { cloud, policy, logs } = await req.json();

    if (!cloud || !policy || !logs) {
      return Response.json(
        { error: "Missing required fields: cloud, policy, logs" },
        { status: 400 }
      );
    }

    let policyObj: unknown;
    try {
      policyObj = JSON.parse(policy);
    } catch {
      return Response.json(
        { error: "Invalid JSON in policy" },
        { status: 400 }
      );
    }

    const grantedPermissions = extractPermissionsFromPolicy(cloud, policyObj);
    const analysis = analyzeUsage(grantedPermissions, logs);

    const result = streamText({
      model,
      system: `You are an expert ${cloudLabel(cloud)} security analyst specializing in least-privilege access. Provide specific, actionable recommendations. Do not use em dashes. Keep recommendations under 400 words.`,
      prompt: `Analyze this ${cloudLabel(cloud)} least-privilege report and provide recommendations.

**Least-Privilege Score:** ${analysis.score}/100
**Permissions:** ${analysis.totalPermissions} total, ${analysis.usedPermissions} used, ${analysis.unusedPermissions} unused

**Unused permissions (candidates for removal):**
${analysis.permissions
  .filter((p) => !p.used)
  .map((p) => `- ${p.action}`)
  .join("\n") || "None - all permissions are actively used"}

**Used permissions:**
${analysis.permissions
  .filter((p) => p.used)
  .map((p) => `- ${p.action} (${p.usageCount} invocations, last used: ${p.lastUsed})`)
  .join("\n")}

**Current policy:**
\`\`\`json
${policy}
\`\`\`

Provide:
1. An assessment of the current least-privilege posture
2. Specific permissions to remove and why
3. A recommended minimal policy that covers only the observed usage
4. Any risks of removing the unused permissions (e.g., break-glass scenarios)
5. A suggested review timeline for re-evaluating this policy`,
    });

    const textStream = result.toTextStreamResponse();
    const analysisMeta = JSON.stringify(analysis);

    return new Response(
      new ReadableStream({
        async start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `<!--LP_META:${analysisMeta}:END_META-->\n`
            )
          );
          const reader = textStream.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
