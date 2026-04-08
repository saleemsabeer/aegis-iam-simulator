"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PolicyEditor } from "@/components/PolicyEditor";
import { DriftDetector } from "@/components/DriftDetector";
import { LeastPrivilegeAnalyzer } from "@/components/LeastPrivilegeAnalyzer";
import type { CloudProvider } from "@/lib/types";

const VALID_CLOUDS = new Set<string>(["aws", "azure", "gcp"]);
const VALID_TABS = new Set<string>(["simulator", "drift", "least-privilege"]);

function AegisApp() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const cloud = useMemo(() => {
    const c = searchParams.get("cloud") ?? "aws";
    return VALID_CLOUDS.has(c) ? (c as CloudProvider) : "aws";
  }, [searchParams]);

  const tab = useMemo(() => {
    const t = searchParams.get("tab") ?? "simulator";
    return VALID_TABS.has(t) ? t : "simulator";
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const setCloud = useCallback(
    (c: CloudProvider) => updateParams({ cloud: c }),
    [updateParams]
  );

  const setTab = useCallback(
    (t: string) => updateParams({ tab: t }),
    [updateParams]
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aegis-cyan/10 border border-aegis-cyan/20">
              <svg
                className="h-5 w-5 text-aegis-cyan"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Aegis
              </h1>
              <p className="text-xs text-muted-foreground">
                IAM Simulator & Drift Detector
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/generate" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Generator</Link>
            <Link href="/validate" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Validator</Link>
            <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Audit</Link>
            <Link href="/demo" className="text-xs text-muted-foreground hover:text-aegis-cyan transition-colors">Demo</Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 bg-secondary/50">
              <TabsTrigger value="simulator" className="data-[state=active]:bg-aegis-cyan data-[state=active]:text-primary-foreground">
                Policy Simulator
              </TabsTrigger>
              <TabsTrigger value="drift" className="data-[state=active]:bg-aegis-cyan data-[state=active]:text-primary-foreground">
                Drift Detector
              </TabsTrigger>
              <TabsTrigger value="least-privilege" className="data-[state=active]:bg-aegis-cyan data-[state=active]:text-primary-foreground">
                Least Privilege
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simulator">
              <PolicyEditor cloud={cloud} onCloudChange={setCloud} />
            </TabsContent>

            <TabsContent value="drift">
              <DriftDetector cloud={cloud} onCloudChange={setCloud} />
            </TabsContent>

            <TabsContent value="least-privilege">
              <LeastPrivilegeAnalyzer
                cloud={cloud}
                onCloudChange={setCloud}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-center text-xs text-muted-foreground">
            Aegis IAM Simulator. Built with Next.js, Tailwind CSS, and Claude.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-aegis-cyan border-t-transparent" />
        </div>
      }
    >
      <AegisApp />
    </Suspense>
  );
}
