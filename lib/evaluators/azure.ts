import type { AzureRoleDefinition, SimulationResult } from "@/lib/types";

function matchPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function matchScope(assignedScope: string, targetResource: string): boolean {
  const normalizedScope = assignedScope.toLowerCase();
  const normalizedResource = targetResource.toLowerCase();
  return (
    normalizedResource === normalizedScope ||
    normalizedResource.startsWith(normalizedScope + "/") ||
    normalizedScope === "/"
  );
}

/**
 * Evaluate an Azure RBAC role definition against an access request.
 * Order: NotActions block first, then Actions allow.
 * Supports both control-plane (Actions) and data-plane (DataActions).
 */
export function evaluateAzurePolicy(
  roles: AzureRoleDefinition[],
  action: string,
  resource: string,
  _principal: string
): SimulationResult {
  for (const role of roles) {
    if (!role.AssignableScopes.some((s) => matchScope(s, resource))) {
      continue;
    }

    const isDataAction =
      action.includes("/") &&
      action.split("/").length > 2 &&
      !action.endsWith("/read") &&
      !action.endsWith("/write") &&
      !action.endsWith("/delete") &&
      !action.endsWith("/action");

    if (isDataAction) {
      const blockedByNotData = (role.NotDataActions ?? []).some((na) =>
        matchPattern(na, action)
      );
      if (blockedByNotData) continue;

      const allowedByData = (role.DataActions ?? []).some((a) =>
        matchPattern(a, action)
      );
      if (allowedByData) {
        return { verdict: "ALLOW", matchedStatement: role };
      }
    }

    const blockedByNot = role.NotActions.some((na) =>
      matchPattern(na, action)
    );
    if (blockedByNot) continue;

    const allowed = role.Actions.some((a) => matchPattern(a, action));
    if (allowed) {
      return { verdict: "ALLOW", matchedStatement: role };
    }
  }

  return { verdict: "IMPLICIT_DENY", matchedStatement: null };
}

/** Extract all granted action patterns from role definitions. */
export function extractAzurePermissions(
  roles: AzureRoleDefinition[]
): string[] {
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const action of role.Actions) {
      permissions.add(action);
    }
    for (const action of role.DataActions ?? []) {
      permissions.add(action);
    }
  }
  return Array.from(permissions);
}
