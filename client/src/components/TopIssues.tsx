import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Issue } from "@/lib/analysis-utils";
import { AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopIssuesProps {
  issues: Issue[];
  className?: string;
}

export function TopIssues({ issues, className }: TopIssuesProps) {
  if (issues.length === 0) {
    return (
      <Card className={cn("w-full border-green-200 bg-green-50", className)}>
        <CardContent className="p-6 flex items-center justify-center text-green-700">
          <span className="text-lg font-medium">No issues found 🎉</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Top Issues
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {issues.map((issue, index) => (
          <div 
            key={`${issue.tagName}-${index}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex flex-col gap-1 mb-2 sm:mb-0">
              <span className="font-medium text-slate-800">
                {issue.description || `Fix ${issue.tagName}`}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                {issue.category} • {issue.tagName}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {issue.quickWin && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Quick Win
                </Badge>
              )}
              <SeverityBadge severity={issue.severity} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  let colorClass = "bg-slate-100 text-slate-700 border-slate-200";
  
  switch (severity) {
    case "Critical":
      colorClass = "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
      break;
    case "High":
      colorClass = "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200";
      break;
    case "Medium":
      colorClass = "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200";
      break;
    case "Low":
      colorClass = "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
      break;
  }

  return (
    <Badge variant="outline" className={cn("font-medium", colorClass)}>
      {severity}
    </Badge>
  );
}
