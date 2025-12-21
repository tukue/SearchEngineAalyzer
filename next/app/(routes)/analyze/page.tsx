"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import URLInputForm from "@/components/URLInputForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { type AnalysisResult } from "@shared/schema";

export default function AnalyzePage() {
  const {
    mutate,
    data,
    isPending,
    isError,
    error,
    reset,
  } = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url });
      return res.json() as Promise<AnalysisResult>;
    },
  });

  const handleSubmit = (url: string) => {
    reset();
    mutate(url);
  };

  const errorMessage = useMemo(() => {
    if (!isError) return "";
    return error instanceof Error
      ? error.message
      : "We couldn't complete the audit. Please try again.";
  }, [error, isError]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="bg-slate-900 text-white py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-3">Next.js beta UI</p>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4">Analyze meta tags with the new API</h1>
          <p className="text-lg text-slate-200 max-w-3xl">
            Run an audit through the migrated Next.js handler and preview results without leaving the new app
            router. Submit any public URL to confirm the endpoint is healthy and returning detailed tag coverage.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl -mt-10 pb-16 space-y-6">
        <URLInputForm onSubmit={handleSubmit} isLoading={isPending} />

        <LoadingState isVisible={isPending} />

        <ErrorState isVisible={isError} errorMessage={errorMessage} onRetry={reset} />

        {data && !isPending && !isError && (
          <Card className="bg-white shadow-md border border-slate-200">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  Audit ready for {data.analysis.url}
                </CardTitle>
                <CardDescription>
                  The Next.js endpoint returned a full meta-tag report with health scoring and recommendations.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-emerald-700 bg-emerald-100 border-emerald-200">
                Health score: {data.analysis.healthScore}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Metric label="SEO tags" value={data.analysis.seoCount} />
                <Metric label="Social tags" value={data.analysis.socialCount} />
                <Metric label="Technical tags" value={data.analysis.technicalCount} />
                <Metric
                  label="Missing essentials"
                  value={data.analysis.missingCount}
                  tone={data.analysis.missingCount > 0 ? "alert" : "default"}
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Review the results in your existing dashboard to validate parity while migrations continue.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Total tags: {data.analysis.totalCount}</Badge>
                  <Badge variant="outline">Timestamp: {data.analysis.timestamp}</Badge>
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="space-y-1 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Success feedback</p>
                  <p>
                    If any important tags are missing, the analyzer already captured recommendations. You can re-run
                    the check with another URL to confirm consistent responses across the migrated stack.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => mutate(data.analysis.url)} disabled={isPending}>
                  Re-run audit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

type MetricProps = {
  label: string;
  value: number;
  tone?: "default" | "alert";
};

function Metric({ label, value, tone = "default" }: MetricProps) {
  const toneClass =
    tone === "alert"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`rounded-md border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
