import type { GCPPolicy, SimulationResult } from "@/lib/types";

/**
 * Hardcoded role-to-permission mappings for commonly used GCP predefined roles.
 * In production you would query the IAM API; this is sufficient for simulation.
 */
const GCP_ROLE_PERMISSIONS: Record<string, string[]> = {
  "roles/viewer": [
    "*.get",
    "*.list",
    "resourcemanager.projects.get",
    "resourcemanager.projects.list",
  ],
  "roles/editor": [
    "*.get",
    "*.list",
    "*.create",
    "*.update",
    "*.delete",
    "resourcemanager.projects.get",
    "resourcemanager.projects.list",
  ],
  "roles/owner": ["*"],
  "roles/storage.objectViewer": [
    "storage.objects.get",
    "storage.objects.list",
    "storage.buckets.get",
    "storage.buckets.list",
  ],
  "roles/storage.objectCreator": [
    "storage.objects.create",
    "storage.objects.get",
    "storage.objects.list",
    "storage.buckets.get",
    "storage.buckets.list",
  ],
  "roles/storage.objectAdmin": [
    "storage.objects.get",
    "storage.objects.list",
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.update",
    "storage.buckets.get",
    "storage.buckets.list",
  ],
  "roles/storage.admin": [
    "storage.objects.get",
    "storage.objects.list",
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.update",
    "storage.buckets.get",
    "storage.buckets.list",
    "storage.buckets.create",
    "storage.buckets.delete",
    "storage.buckets.update",
    "storage.buckets.setIamPolicy",
    "storage.buckets.getIamPolicy",
  ],
  "roles/bigquery.dataViewer": [
    "bigquery.datasets.get",
    "bigquery.tables.get",
    "bigquery.tables.list",
    "bigquery.tables.getData",
  ],
  "roles/bigquery.dataEditor": [
    "bigquery.datasets.get",
    "bigquery.tables.get",
    "bigquery.tables.list",
    "bigquery.tables.getData",
    "bigquery.tables.create",
    "bigquery.tables.update",
    "bigquery.tables.delete",
    "bigquery.tables.updateData",
  ],
  "roles/bigquery.admin": [
    "bigquery.datasets.get",
    "bigquery.datasets.create",
    "bigquery.datasets.delete",
    "bigquery.datasets.update",
    "bigquery.tables.get",
    "bigquery.tables.list",
    "bigquery.tables.create",
    "bigquery.tables.update",
    "bigquery.tables.delete",
    "bigquery.tables.getData",
    "bigquery.tables.updateData",
    "bigquery.jobs.create",
    "bigquery.jobs.get",
    "bigquery.jobs.list",
  ],
  "roles/compute.viewer": [
    "compute.instances.get",
    "compute.instances.list",
    "compute.networks.get",
    "compute.networks.list",
    "compute.firewalls.get",
    "compute.firewalls.list",
    "compute.disks.get",
    "compute.disks.list",
  ],
  "roles/compute.instanceAdmin.v1": [
    "compute.instances.get",
    "compute.instances.list",
    "compute.instances.create",
    "compute.instances.delete",
    "compute.instances.start",
    "compute.instances.stop",
    "compute.instances.update",
    "compute.instances.setMetadata",
    "compute.disks.get",
    "compute.disks.list",
    "compute.disks.create",
  ],
  "roles/iam.serviceAccountUser": [
    "iam.serviceAccounts.actAs",
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.list",
  ],
  "roles/iam.serviceAccountAdmin": [
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.list",
    "iam.serviceAccounts.create",
    "iam.serviceAccounts.delete",
    "iam.serviceAccounts.update",
    "iam.serviceAccounts.setIamPolicy",
    "iam.serviceAccounts.getIamPolicy",
  ],
  "roles/logging.viewer": [
    "logging.logEntries.list",
    "logging.logs.list",
    "logging.logServices.list",
    "logging.sinks.get",
    "logging.sinks.list",
  ],
};

function matchPermission(granted: string, requested: string): boolean {
  if (granted === "*") return true;
  if (granted === requested) return true;

  if (granted.includes("*")) {
    const escaped = granted
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(requested);
  }

  return false;
}

function roleGrantsPermission(role: string, permission: string): boolean {
  const perms = GCP_ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.some((p) => matchPermission(p, permission));
}

/**
 * Evaluate a GCP IAM policy against a permission request.
 * Checks each binding's role for the requested permission and verifies
 * the principal is in the members list.
 */
export function evaluateGCPPolicy(
  policy: GCPPolicy,
  permission: string,
  _resource: string,
  principal: string
): SimulationResult {
  for (const binding of policy.bindings) {
    const memberMatch =
      binding.members.includes(principal) ||
      binding.members.includes("allUsers") ||
      binding.members.includes("allAuthenticatedUsers");

    if (!memberMatch) continue;

    if (roleGrantsPermission(binding.role, permission)) {
      return {
        verdict: "ALLOW",
        matchedStatement: {
          ...binding,
          ...(binding.condition
            ? { conditionNote: "Condition present but not fully evaluated" }
            : {}),
        },
      };
    }
  }

  return { verdict: "IMPLICIT_DENY", matchedStatement: null };
}

/** Extract all permissions granted by the bindings in a GCP policy. */
export function extractGCPPermissions(policy: GCPPolicy): string[] {
  const permissions = new Set<string>();
  for (const binding of policy.bindings) {
    const perms = GCP_ROLE_PERMISSIONS[binding.role];
    if (perms) {
      for (const p of perms) {
        if (!p.includes("*")) {
          permissions.add(p);
        }
      }
    }
  }
  return Array.from(permissions);
}
