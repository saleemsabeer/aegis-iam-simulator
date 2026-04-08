import type { CloudProvider } from "@/lib/types";

// ─── Sample Policies ────────────────────────────────────────────────────────

export const samplePolicies: Record<CloudProvider, string> = {
  aws: JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowS3ReadProdData",
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:ListBucket", "s3:GetBucketLocation"],
          Resource: [
            "arn:aws:s3:::prod-data",
            "arn:aws:s3:::prod-data/*",
          ],
        },
        {
          Sid: "AllowCloudWatchRead",
          Effect: "Allow",
          Action: [
            "cloudwatch:GetMetricData",
            "cloudwatch:ListMetrics",
            "cloudwatch:DescribeAlarms",
            "logs:GetLogEvents",
            "logs:DescribeLogGroups",
          ],
          Resource: "*",
        },
        {
          Sid: "DenyDeleteOperations",
          Effect: "Deny",
          Action: [
            "s3:DeleteObject",
            "s3:DeleteBucket",
            "ec2:TerminateInstances",
          ],
          Resource: "*",
        },
      ],
    },
    null,
    2
  ),

  azure: JSON.stringify(
    [
      {
        Name: "Custom Data Analyst",
        Description:
          "Read access to most resources, blocked from secrets and keys",
        Actions: [
          "*/read",
          "Microsoft.Insights/metrics/read",
          "Microsoft.Insights/diagnosticSettings/read",
          "Microsoft.Resources/subscriptions/resourceGroups/read",
        ],
        NotActions: [
          "Microsoft.KeyVault/vaults/secrets/*",
          "Microsoft.KeyVault/vaults/keys/*",
          "Microsoft.Authorization/roleAssignments/write",
          "Microsoft.Authorization/roleAssignments/delete",
        ],
        DataActions: [
          "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read",
        ],
        NotDataActions: [],
        AssignableScopes: [
          "/subscriptions/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        ],
      },
    ],
    null,
    2
  ),

  gcp: JSON.stringify(
    {
      bindings: [
        {
          role: "roles/storage.objectViewer",
          members: [
            "user:analyst@example.com",
            "serviceAccount:data-pipeline@my-project.iam.gserviceaccount.com",
          ],
        },
        {
          role: "roles/bigquery.dataViewer",
          members: ["user:analyst@example.com"],
          condition: {
            title: "Business hours only",
            description: "Restrict access to business hours in US Eastern",
            expression:
              'request.time.getHours("America/New_York") >= 9 && request.time.getHours("America/New_York") <= 17',
          },
        },
        {
          role: "roles/logging.viewer",
          members: [
            "user:analyst@example.com",
            "group:security-team@example.com",
          ],
        },
      ],
    },
    null,
    2
  ),
};

// ─── Sample Simulation Requests ─────────────────────────────────────────────

export const sampleRequests: Record<
  CloudProvider,
  { action: string; resource: string; principal: string }
> = {
  aws: {
    action: "s3:GetObject",
    resource: "arn:aws:s3:::prod-data/reports/q4.csv",
    principal: "arn:aws:iam::123456789012:user/analyst",
  },
  azure: {
    action: "Microsoft.Storage/storageAccounts/read",
    resource:
      "/subscriptions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/resourceGroups/analytics-rg/providers/Microsoft.Storage/storageAccounts/prodstorage",
    principal: "user@contoso.com",
  },
  gcp: {
    action: "storage.objects.get",
    resource: "projects/my-project/buckets/prod-data/objects/report.csv",
    principal: "user:analyst@example.com",
  },
};

// ─── Sample Drift Data ──────────────────────────────────────────────────────

export const sampleDriftBaseline: Record<CloudProvider, string> = {
  aws: JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowS3Read",
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:ListBucket"],
          Resource: [
            "arn:aws:s3:::prod-data",
            "arn:aws:s3:::prod-data/*",
          ],
        },
        {
          Sid: "DenyDelete",
          Effect: "Deny",
          Action: ["s3:DeleteObject", "s3:DeleteBucket"],
          Resource: "*",
        },
      ],
    },
    null,
    2
  ),

  azure: JSON.stringify(
    [
      {
        Name: "Custom Reader",
        Description: "Read-only access",
        Actions: ["*/read"],
        NotActions: ["Microsoft.KeyVault/vaults/secrets/*"],
        DataActions: [],
        NotDataActions: [],
        AssignableScopes: [
          "/subscriptions/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        ],
      },
    ],
    null,
    2
  ),

  gcp: JSON.stringify(
    {
      bindings: [
        {
          role: "roles/storage.objectViewer",
          members: ["user:analyst@example.com"],
        },
      ],
    },
    null,
    2
  ),
};

export const sampleDriftCurrent: Record<CloudProvider, string> = {
  aws: JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowS3Read",
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
          Resource: "*",
        },
        {
          Sid: "AllowEC2Full",
          Effect: "Allow",
          Action: "ec2:*",
          Resource: "*",
        },
      ],
    },
    null,
    2
  ),

  azure: JSON.stringify(
    [
      {
        Name: "Custom Reader",
        Description: "Updated access",
        Actions: ["*/read", "*/write", "*/delete"],
        NotActions: [],
        DataActions: [],
        NotDataActions: [],
        AssignableScopes: ["/"],
      },
    ],
    null,
    2
  ),

  gcp: JSON.stringify(
    {
      bindings: [
        {
          role: "roles/storage.objectAdmin",
          members: [
            "user:analyst@example.com",
            "allAuthenticatedUsers",
          ],
        },
        {
          role: "roles/compute.instanceAdmin.v1",
          members: ["user:analyst@example.com"],
        },
      ],
    },
    null,
    2
  ),
};

// ─── Sample Least-Privilege Logs ────────────────────────────────────────────

export const sampleLogs: Record<
  CloudProvider,
  { action: string; timestamp: string; count: number }[]
> = {
  aws: [
    { action: "s3:GetObject", timestamp: "2026-04-06T14:30:00Z", count: 342 },
    { action: "s3:ListBucket", timestamp: "2026-04-06T14:30:00Z", count: 128 },
    { action: "logs:GetLogEvents", timestamp: "2026-04-05T09:15:00Z", count: 56 },
    {
      action: "cloudwatch:GetMetricData",
      timestamp: "2026-04-04T16:45:00Z",
      count: 23,
    },
  ],
  azure: [
    {
      action: "Microsoft.Storage/storageAccounts/read",
      timestamp: "2026-04-06T11:00:00Z",
      count: 87,
    },
    {
      action: "Microsoft.Insights/metrics/read",
      timestamp: "2026-04-05T15:30:00Z",
      count: 34,
    },
  ],
  gcp: [
    { action: "storage.objects.get", timestamp: "2026-04-06T10:00:00Z", count: 215 },
    { action: "storage.objects.list", timestamp: "2026-04-06T10:00:00Z", count: 98 },
    { action: "bigquery.tables.getData", timestamp: "2026-04-05T14:20:00Z", count: 45 },
  ],
};
