import { streamText } from "ai";
import { model } from "@/lib/anthropic";
import type { CloudProvider, DriftItem, DriftSeverity } from "@/lib/types";

export const runtime = "edge";

function cloudLabel(cloud: CloudProvider): string {
  return { aws: "AWS IAM", azure: "Azure RBAC", gcp: "GCP IAM" }[cloud];
}

// ─── Generic deep diff ──────────────────────────────────────────────────────

function deepDiff(
  baseline: unknown,
  current: unknown,
  path: string
): DriftItem[] {
  if (baseline === current) return [];

  if (baseline === null || baseline === undefined) {
    return [
      {
        type: "added",
        path,
        current,
        severity: "medium",
        description: `New value added at ${path}`,
      },
    ];
  }

  if (current === null || current === undefined) {
    return [
      {
        type: "removed",
        path,
        baseline,
        severity: "medium",
        description: `Value removed at ${path}`,
      },
    ];
  }

  if (typeof baseline !== typeof current) {
    return [
      {
        type: "modified",
        path,
        baseline,
        current,
        severity: "high",
        description: `Type changed from ${typeof baseline} to ${typeof current} at ${path}`,
      },
    ];
  }

  if (Array.isArray(baseline) && Array.isArray(current)) {
    const items: DriftItem[] = [];
    const maxLen = Math.max(baseline.length, current.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = `${path}[${i}]`;
      if (i >= baseline.length) {
        items.push({
          type: "added",
          path: itemPath,
          current: current[i],
          severity: "medium",
          description: `New item added at ${itemPath}`,
        });
      } else if (i >= current.length) {
        items.push({
          type: "removed",
          path: itemPath,
          baseline: baseline[i],
          severity: "medium",
          description: `Item removed at ${itemPath}`,
        });
      } else {
        items.push(...deepDiff(baseline[i], current[i], itemPath));
      }
    }
    return items;
  }

  if (typeof baseline === "object" && baseline !== null && current !== null) {
    const items: DriftItem[] = [];
    const baseObj = baseline as Record<string, unknown>;
    const currObj = current as Record<string, unknown>;
    const allKeys = new Set([
      ...Object.keys(baseObj),
      ...Object.keys(currObj),
    ]);
    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      if (!(key in baseObj)) {
        items.push({
          type: "added",
          path: keyPath,
          current: currObj[key],
          severity: "medium",
          description: `New property "${key}" added`,
        });
      } else if (!(key in currObj)) {
        items.push({
          type: "removed",
          path: keyPath,
          baseline: baseObj[key],
          severity: "medium",
          description: `Property "${key}" removed`,
        });
      } else {
        items.push(...deepDiff(baseObj[key], currObj[key], keyPath));
      }
    }
    return items;
  }

  if (baseline !== current) {
    return [
      {
        type: "modified",
        path,
        baseline,
        current,
        severity: "medium",
        description: `Value changed at ${path}`,
      },
    ];
  }

  return [];
}

// ─── Cloud-specific severity scoring ────────────────────────────────────────

function scoreSeverity(
  cloud: CloudProvider,
  item: DriftItem
): DriftItem {
  const p = item.path.toLowerCase();

  if (cloud === "aws") {
    if (item.type === "removed" && isObj(item.baseline) && item.baseline.Effect === "Deny") {
      return { ...item, severity: "critical", description: "Deny statement removed from policy" };
    }
    if (item.type === "added" && isObj(item.current) && item.current.Effect === "Allow") {
      return { ...item, severity: "high", description: "New Allow statement added to policy" };
    }
    if (p.includes("resource") && item.current === "*") {
      return { ...item, severity: "critical", description: "Resource changed to wildcard (*)" };
    }
    if (p.includes("action") && item.current === "*") {
      return { ...item, severity: "critical", description: "Action changed to wildcard (*)" };
    }
    if (p.includes("action") && item.type === "added") {
      return { ...item, severity: "high", description: `New action added: ${String(item.current)}` };
    }
  }

  if (cloud === "azure") {
    if (p.includes("notactions") && item.type === "removed") {
      return { ...item, severity: "critical", description: "NotActions restriction removed" };
    }
    if (p.includes("actions") && item.type === "added") {
      return { ...item, severity: "high", description: `New action granted: ${String(item.current)}` };
    }
    if (p.includes("assignablescopes") && item.current === "/") {
      return { ...item, severity: "critical", description: "Scope broadened to root (/)" };
    }
  }

  if (cloud === "gcp") {
    if (p.includes("members") && item.current === "allAuthenticatedUsers") {
      return { ...item, severity: "critical", description: "allAuthenticatedUsers added to binding" };
    }
    if (p.includes("members") && item.current === "allUsers") {
      return { ...item, severity: "critical", description: "allUsers (public) added to binding" };
    }
    if (p.includes("role") && item.type === "modified") {
      return { ...item, severity: "high", description: `Role changed from ${String(item.baseline)} to ${String(item.current)}` };
    }
    if (p.includes("condition") && item.type === "removed") {
      return { ...item, severity: "high", description: "IAM condition removed from binding" };
    }
  }

  return item;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function overallSeverity(items: DriftItem[]): DriftSeverity {
  if (items.some((i) => i.severity === "critical")) return "critical";
  if (items.some((i) => i.severity === "high")) return "high";
  if (items.some((i) => i.severity === "medium")) return "medium";
  return "low";
}

export async function POST(req: Request) {
  try {
    const { cloud, baseline, current } = await req.json();

    if (!cloud || !baseline || !current) {
      return Response.json(
        { error: "Missing required fields: cloud, baseline, current" },
        { status: 400 }
      );
    }

    let baselineObj: unknown;
    let currentObj: unknown;
    try {
      baselineObj = JSON.parse(baseline);
      currentObj = JSON.parse(current);
    } catch {
      return Response.json(
        { error: "Invalid JSON in baseline or current policy" },
        { status: 400 }
      );
    }

    const rawItems = deepDiff(baselineObj, currentObj, "root");
    const items = rawItems.map((item) => scoreSeverity(cloud, item));
    const severity = overallSeverity(items);

    const result = streamText({
      model,
      system: `You are an expert ${cloudLabel(cloud)} security analyst specializing in policy drift detection. Provide clear risk analysis and actionable remediation steps. Do not use em dashes. Keep your response under 400 words.`,
      prompt: `Analyze the following ${cloudLabel(cloud)} policy drift. Overall severity: ${severity.toUpperCase()}.

**Drift items (${items.length} changes detected):**
${items.map((item, i) => `${i + 1}. [${item.severity.toUpperCase()}] ${item.description} (${item.type} at ${item.path})`).join("\n")}

**Baseline policy:**
\`\`\`json
${baseline}
\`\`\`

**Current policy:**
\`\`\`json
${current}
\`\`\`

Provide:
1. A risk summary of the most critical changes
2. The potential security impact of each high/critical drift item
3. Specific remediation steps to bring the policy back to a secure state
4. Whether the drift pattern suggests intentional escalation or accidental misconfiguration`,
    });

    const textStream = result.toTextStreamResponse();
    const driftMeta = JSON.stringify({ items, severity });

    return new Response(
      new ReadableStream({
        async start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`<!--DRIFT_META:${driftMeta}:END_META-->\n`)
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
