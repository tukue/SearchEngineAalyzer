import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthSummary } from "@/lib/analysis-utils";
import { cn } from "@/lib/utils";

interface HealthSummaryCardProps {
  summary: HealthSummary;
  className?: string;
}

export function HealthSummaryCard({ summary, className }: HealthSummaryCardProps) {
  const score = typeof summary.score === "number" ? summary.score : 0;
  
  let scoreColor = "bg-slate-500";
  let scoreLabel = "Unknown";
  
  if (typeof summary.score === "number") {
    if (score >= 90) {
      scoreColor = "bg-green-500";
      scoreLabel = "Good";
    } else if (score >= 50) {
      scoreColor = "bg-yellow-500";
      scoreLabel = "Fair";
    } else {
      scoreColor = "bg-red-500";
      scoreLabel = "Poor";
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          {/* Left: Score */}
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <div className={cn("text-4xl font-bold text-white rounded-full w-20 h-20 flex items-center justify-center mb-2", scoreColor)}>
              {summary.score}
            </div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Health Score</div>
            {typeof summary.score === "number" && (
              <Badge variant="outline" className="mt-2 border-slate-200">
                {scoreLabel}
              </Badge>
            )}
          </div>

          {/* Right: Categories */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <CategoryStat label="SEO" pass={summary.seo.pass} fail={summary.seo.fail} />
            <CategoryStat label="Social" pass={summary.social.pass} fail={summary.social.fail} />
            <CategoryStat label="Technical" pass={summary.technical.pass} fail={summary.technical.fail} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryStat({ label, pass, fail }: { label: string; pass: number; fail: number }) {
  return (
    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
      <span className="font-semibold text-slate-700 mb-2">{label}</span>
      <div className="flex justify-between items-center text-sm">
        <span className="text-green-600 font-medium">Pass: {pass}</span>
        <span className="text-red-600 font-medium">Fail: {fail}</span>
      </div>
      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
        <div 
          className="bg-green-500 h-full" 
          style={{ width: `${(pass + fail) > 0 ? (pass / (pass + fail)) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
