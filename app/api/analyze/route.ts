import { streamText } from "ai";
import { model } from "@/lib/anthropic";
import type { AnalyzeRequest, CloudProvider, VerdictType } from "@/lib/types";

export const runtime = "edge";

function cloudLabel(cloud: CloudProvider): string {
  return { aws: "AWS IAM", azure: "Azure RBAC", gcp: "GCP IAM" }[cloud];
}

function verdictLabel(verdict: VerdictType): string {
  return {
    ALLOW: "ALLOWED",
    EXPLICIT_DENY: "EXPLICITLY DENIED",
    IMPLICIT_DENY: "IMPLICITLY DENIED (no matching allow statement)",
  }[verdict];
}

export async function POST(req: Request) {
  try {
    const body: AnalyzeRequest = await req.json();
    const { cloud, policy, action, resource, principal, verdict, matchedStatement } = body;

    if (!cloud || !policy || !action || !resource || !principal || !verdict) {
      return Response.json(
        { error: "Missing required fields: cloud, policy, action, resource, principal, verdict" },
        { status: 400 }
      );
    }

    const result = streamText({
      model,
      system: `You are an expert ${cloudLabel(cloud)} security analyst. Provide clear, concise explanations of IAM policy evaluation results. Focus on security implications and actionable guidance. Do not use em dashes. Keep explanations under 300 words.`,
      prompt: `Explain why the following ${cloudLabel(cloud)} access request was ${verdictLabel(verdict)}.

**Request:**
- Action: ${action}
- Resource: ${resource}
- Principal: ${principal}

**Policy:**
\`\`\`json
${policy}
\`\`\`

**Verdict:** ${verdict}
${matchedStatement ? `\n**Matched Statement:**\n\`\`\`json\n${JSON.stringify(matchedStatement, null, 2)}\n\`\`\`` : "\n**No matching statement found.**"}

Explain:
1. Why this specific verdict was reached (trace the evaluation logic)
2. Which statement(s) were relevant and why
3. Security implications of this access decision
4. Any recommendations for improving the policy`,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
