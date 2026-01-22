import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { useUsageStatus } from "@/hooks/useUsageStatus";

export function UsageWidget() {
  const { usage, loading } = useUsageStatus();

  if (loading || !usage) return null;

  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  
  let progressColor = "bg-blue-500";
  if (usage.warning_level === "warning_90") progressColor = "bg-orange-500";
  if (usage.warning_level === "exceeded") progressColor = "bg-red-500";

  return (
    <Card className="mb-8">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Monthly Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-end mb-2">
          <span className="text-2xl font-bold">{usage.used}</span>
          <span className="text-sm text-slate-500 mb-1">/ {usage.limit} audits</span>
        </div>
        <Progress value={percent} className="h-2" indicatorClassName={progressColor} />
        
        {usage.warning_level !== "none" && (
          <Alert className="mt-4 border-orange-200 bg-orange-50 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-xs text-orange-700 ml-2">
              {usage.warning_level === "exceeded" 
                ? "Monthly limit reached. Upgrade to continue."
                : `You have used ${percent}% of your monthly quota.`}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
