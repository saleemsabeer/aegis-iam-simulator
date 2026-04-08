import { streamText } from "ai";
import { model } from "@/lib/anthropic";
import type { CloudProvider } from "@/lib/types";

export const runtime = "edge";

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

function cloudLabel(cloud: CloudProvider): string {
  return { aws: "AWS IAM", azure: "Azure RBAC", gcp: "GCP IAM" }[cloud];
}

function analyzePolicy(cloud: CloudProvider, policyObj: unknown): ValidationMeta {
  const findings: Finding[] = [];
  const policyStr = JSON.stringify(policyObj);

  if (cloud === "aws") {
    const policy = policyObj as { Statement?: Array<{ Effect?: string; Action?: string | string[]; Resource?: string | string[]; Condition?: unknown; Principal?: unknown }> };
    for (const stmt of policy.Statement ?? []) {
      const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action ?? ""];
      const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource ?? ""];

      if (stmt.Effect === "Allow") {
        if (actions.some((a) => a === "*")) {
          findings.push({ title: "Wildcard Action Detected", severity: "critical", description: "Statement grants all actions (*). This violates least-privilege and gives unrestricted API access." });
        } else if (actions.some((a) => a?.includes("*"))) {
          findings.push({ title: "Broad Wildcard in Action", severity: "high", description: `Action pattern contains wildcards: ${actions.filter((a) => a?.includes("*")).join(", ")}` });
        }
        if (resources.some((r) => r === "*")) {
          findings.push({ title: "Wildcard Resource", severity: "high", description: "Statement applies to all resources (*). Scope down to specific ARNs." });
        }
        if (!stmt.Condition) {
          if (actions.some((a) => a === "*") || resources.some((r) => r === "*")) {
            findings.push({ title: "Missing Condition Block", severity: "medium", description: "Broad statement has no conditions. Add IP, MFA, or time-based conditions to restrict access." });
          }
        }
        if (actions.some((a) => a?.toLowerCase().includes("delete") || a?.toLowerCase().includes("remove") || a?.toLowerCase().includes("terminate"))) {
          findings.push({ title: "Destructive Actions Allowed", severity: "high", description: "Policy allows delete/terminate operations. Consider requiring MFA or adding explicit deny guardrails." });
        }
      }
    }
    if (!policy.Statement?.some((s) => s.Effect === "Deny")) {
      findings.push({ title: "No Explicit Deny Statements", severity: "low", description: "Policy has no deny statements. Consider adding explicit deny rules for sensitive actions as guardrails." });
    }
  }

  if (cloud === "azure") {
    const roles = (Array.isArray(policyObj) ? policyObj : [policyObj]) as Array<{ Actions?: string[]; NotActions?: string[]; AssignableScopes?: string[] }>;
    for (const role of roles) {
      if (role.Actions?.includes("*")) {
        findings.push({ title: "Wildcard Action Detected", severity: "critical", description: "Role grants all actions (*). This is equivalent to Owner/Contributor with no restrictions." });
      }
      if ((role.NotActions ?? []).length === 0 && (role.Actions ?? []).some((a) => a?.includes("*"))) {
        findings.push({ title: "No NotActions Restrictions", severity: "high", description: "Broad action patterns without NotActions exclusions. Add NotActions to block sensitive operations." });
      }
      if (role.AssignableScopes?.includes("/")) {
        findings.push({ title: "Root Scope Assignment", severity: "critical", description: "Role is assignable at root scope (/). This grants access across all subscriptions." });
      }
    }
  }

  if (cloud === "gcp") {
    const policy = policyObj as { bindings?: Array<{ role?: string; members?: string[]; condition?: unknown }> };
    for (const binding of policy.bindings ?? []) {
      if (binding.members?.includes("allUsers")) {
        findings.push({ title: "Public Access (allUsers)", severity: "critical", description: "Binding grants access to allUsers, making the resource publicly accessible to the internet." });
      }
      if (binding.members?.includes("allAuthenticatedUsers")) {
        findings.push({ title: "All Authenticated Users Access", severity: "critical", description: "Binding grants access to allAuthenticatedUsers. Any Google account can access this resource." });
      }
      if (binding.role?.includes("admin") || binding.role?.includes("owner") || binding.role?.includes("editor")) {
        findings.push({ title: "Overly Permissive Role", severity: "high", description: `Role ${binding.role} grants broad permissions. Use more specific predefined or custom roles.` });
      }
      if (!binding.condition) {
        findings.push({ title: "No IAM Condition", severity: "low", description: `Binding for ${binding.role} has no conditions. Consider adding time or resource-based conditions.` });
      }
    }
  }

  // Generic checks
  if (policyStr.length > 6000) {
    findings.push({ title: "Policy Size Warning", severity: "low", description: "Policy is large. Consider splitting into multiple policies for better manageability." });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const uniqueFindings = findings.filter((f) => {
    if (seen.has(f.title)) return false;
    seen.add(f.title);
    return true;
  });

  // Score calculation
  const criticalCount = uniqueFindings.filter((f) => f.severity === "critical").length;
  const highCount = uniqueFindings.filter((f) => f.severity === "high").length;
  const mediumCount = uniqueFindings.filter((f) => f.severity === "medium").length;
  const lowCount = uniqueFindings.filter((f) => f.severity === "low").length;
  const rawScore = 100 - (criticalCount * 25 + highCount * 12 + mediumCount * 5 + lowCount * 2);
  const score = Math.max(0, Math.min(100, rawScore));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  // Compliance
  const hasCritical = criticalCount > 0;
  const hasHigh = highCount > 0;
  const compliance = {
    pci_dss: { status: (hasCritical ? "fail" : hasHigh ? "partial" : "pass") as ComplianceStatus["status"], issues: criticalCount + highCount },
    hipaa: { status: (hasCritical ? "fail" : hasHigh ? "partial" : "pass") as ComplianceStatus["status"], issues: criticalCount },
    sox: { status: (hasCritical ? "fail" : mediumCount > 0 ? "partial" : "pass") as ComplianceStatus["status"], issues: criticalCount + mediumCount },
    gdpr: { status: (hasCritical ? "partial" : "pass") as ComplianceStatus["status"], issues: hasCritical ? 1 : 0 },
    cis: { status: (hasCritical || hasHigh ? "fail" : mediumCount > 0 ? "partial" : "pass") as ComplianceStatus["status"], issues: criticalCount + highCount + mediumCount },
  };

  return { score, grade, findings: uniqueFindings, compliance };
}

export async function POST(req: Request) {
  try {
    const { cloud, policy } = await req.json();

    if (!cloud || !policy) {
      return Response.json({ error: "Missing required fields: cloud, policy" }, { status: 400 });
    }

    let policyObj: unknown;
    try {
      policyObj = JSON.parse(policy);
    } catch {
      return Response.json({ error: "Invalid JSON in policy" }, { status: 400 });
    }

    const meta = analyzePolicy(cloud, policyObj);

    const result = streamText({
      model,
      system: `You are an expert ${cloudLabel(cloud)} security analyst. Provide detailed security analysis of IAM policies. Focus on risks, compliance implications, and specific remediation steps. Do not use em dashes. Keep the analysis under 500 words.`,
      prompt: `Analyze this ${cloudLabel(cloud)} policy for security issues.

**Security Score:** ${meta.score}/100 (Grade ${meta.grade})
**Findings:** ${meta.findings.length} issues found
${meta.findings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join("\n")}

**Policy:**
\`\`\`json
${policy}
\`\`\`

Provide:
1. Executive summary of the security posture
2. Detailed analysis of each finding with specific remediation steps
3. Compliance implications (PCI DSS, HIPAA, SOX, GDPR, CIS)
4. A recommended remediated version of the policy
5. Priority order for fixing the issues`,
    });

    const textStream = result.toTextStreamResponse();
    const metaJson = JSON.stringify(meta);

    return new Response(
      new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(`<!--VALIDATE_META:${metaJson}:END_META-->\n`));
          const reader = textStream.body?.getReader();
          if (!reader) { controller.close(); return; }
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
