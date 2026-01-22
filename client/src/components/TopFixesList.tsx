import { TopFix } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface TopFixesListProps {
  fixes: TopFix[];
}

export default function TopFixesList({ fixes }: TopFixesListProps) {
  if (!fixes || fixes.length === 0) {
    return (
      <Card className="mb-8 border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Great job! No critical issues found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string): "default" | "caution" | "secondary" | "outline" => {
    switch (severity) {
      case "Critical": return "caution";
      case "High": return "caution"; // Use caution for high severity
      case "Medium": return "secondary";
      case "Low": return "outline";
      default: return "secondary";
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Top Fixes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fixes.map((fix, index) => (
            <div key={index} className="border rounded-lg p-4 bg-slate-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-900">{fix.title}</h3>
                <Badge variant={getSeverityColor(fix.severity)}>{fix.severity}</Badge>
              </div>
              <p className="text-sm text-slate-600 mb-2">{fix.why}</p>
              <div className="text-xs bg-white p-2 rounded border font-mono text-slate-700">
                {fix.how}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
