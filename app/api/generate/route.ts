import { streamText } from "ai";
import { model } from "@/lib/anthropic";
import type { CloudProvider } from "@/lib/types";

export const runtime = "edge";

function cloudLabel(cloud: CloudProvider): string {
  return { aws: "AWS IAM", azure: "Azure RBAC", gcp: "GCP IAM" }[cloud];
}

function systemPrompt(cloud: CloudProvider): string {
  const format = cloud === "aws"
    ? "AWS IAM policy JSON with Version and Statement array"
    : cloud === "azure"
      ? "Azure RBAC role definition JSON with Actions, NotActions, DataActions, NotDataActions, and AssignableScopes"
      : "GCP IAM policy JSON with bindings array containing role and members";

  return `You are an expert ${cloudLabel(cloud)} security engineer. Generate production-ready IAM policies from natural language descriptions.

Rules:
- Output ONLY valid ${format}
- Always follow least-privilege principles
- Never use wildcard (*) actions unless explicitly requested
- Scope resources as narrowly as possible
- Add comments explaining each statement using the Sid field (AWS) or descriptions
- Do not use em dashes

Format your response as:
1. First, output the policy JSON inside a \`\`\`json code fence
2. Then a blank line
3. Then a plain-English explanation covering:
   - What the policy allows and denies
   - Security considerations
   - Any assumptions made
   - Suggestions for further hardening`;
}

export async function POST(req: Request) {
  try {
    const { cloud, description } = await req.json();

    if (!cloud || !description) {
      return Response.json({ error: "Missing required fields: cloud, description" }, { status: 400 });
    }

    const result = streamText({
      model,
      system: systemPrompt(cloud),
      prompt: `Generate a ${cloudLabel(cloud)} policy for the following requirement:\n\n${description}`,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
