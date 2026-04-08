import type { AWSPolicy, AWSStatement, SimulationResult } from "@/lib/types";

function matchPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function matchAction(
  statementActions: string | string[],
  action: string
): boolean {
  const actions = Array.isArray(statementActions)
    ? statementActions
    : [statementActions];
  return actions.some((a) => matchPattern(a, action));
}

function matchResource(
  statementResources: string | string[],
  resource: string
): boolean {
  const resources = Array.isArray(statementResources)
    ? statementResources
    : [statementResources];
  return resources.some((r) => matchPattern(r, resource));
}

/**
 * Evaluate an AWS IAM policy against an access request.
 * Evaluation order: Explicit Deny > Allow > Implicit Deny.
 * All statements are checked; first explicit deny wins immediately.
 */
export function evaluateAWSPolicy(
  policy: AWSPolicy,
  action: string,
  resource: string,
  _principal: string
): SimulationResult {
  let matchedAllow: AWSStatement | null = null;

  for (const statement of policy.Statement) {
    let actionMatch = false;
    if (statement.NotAction) {
      actionMatch = !matchAction(statement.NotAction, action);
    } else {
      actionMatch = matchAction(statement.Action, action);
    }

    if (!actionMatch) continue;

    let resourceMatch = false;
    if (statement.NotResource) {
      resourceMatch = !matchResource(statement.NotResource, resource);
    } else {
      resourceMatch = matchResource(statement.Resource, resource);
    }

    if (!resourceMatch) continue;

    if (statement.Effect === "Deny") {
      return { verdict: "EXPLICIT_DENY", matchedStatement: statement };
    }

    if (statement.Effect === "Allow" && !matchedAllow) {
      matchedAllow = statement;
    }
  }

  if (matchedAllow) {
    return { verdict: "ALLOW", matchedStatement: matchedAllow };
  }

  return { verdict: "IMPLICIT_DENY", matchedStatement: null };
}

/** Extract all explicitly granted action strings from a policy. */
export function extractAWSPermissions(policy: AWSPolicy): string[] {
  const permissions = new Set<string>();
  for (const statement of policy.Statement) {
    if (statement.Effect !== "Allow") continue;
    if (statement.NotAction) continue;
    const actions = Array.isArray(statement.Action)
      ? statement.Action
      : [statement.Action];
    for (const a of actions) {
      permissions.add(a);
    }
  }
  return Array.from(permissions);
}
