import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface AuditRun {
  id: number;
  target: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "SUCCEEDED" | "FAILED";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  progress?: number;
}

interface AuditStatusTrackerProps {
  runId?: number;
  onComplete?: (runId: number) => void;
}

export default function AuditStatusTracker({ runId, onComplete }: AuditStatusTrackerProps) {
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const { data: run, isLoading, refetch } = useQuery({
    queryKey: ["audit-status", runId],
    queryFn: async () => {
      if (!runId) return null;
      const res = await apiRequest("GET", `/api/audits/${runId}`);
      return res.json() as Promise<{ run: AuditRun }>;
    },
    enabled: !!runId,
    refetchInterval: pollingEnabled && runId ? 2000 : false, // Poll every 2 seconds
  });

  // Stop polling when audit is complete
  useEffect(() => {
    if (run?.run && ["COMPLETED", "SUCCEEDED", "FAILED"].includes(run.run.status)) {
      setPollingEnabled(false);
      if ((run.run.status === "COMPLETED" || run.run.status === "SUCCEEDED") && onComplete) {
        onComplete(run.run.id);
      }
    }
  }, [run?.run?.status, onComplete]);

  if (!runId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 animate-pulse" />
            Loading Audit Status...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!run?.run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Audit Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Could not find audit run with ID {runId}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { run: auditRun } = run;
  
  const getStatusIcon = () => {
    switch (auditRun.status) {
      case "QUEUED":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "RUNNING":
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case "COMPLETED":
      case "SUCCEEDED":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (auditRun.status) {
      case "QUEUED":
        return "secondary";
      case "RUNNING":
        return "default";
      case "COMPLETED":
      case "SUCCEEDED":
        return "default";
      case "FAILED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getProgressValue = () => {
    switch (auditRun.status) {
      case "QUEUED":
        return auditRun.progress || 10;
      case "RUNNING":
        return auditRun.progress || 18;
      case "COMPLETED":
      case "SUCCEEDED":
        return 100;
      case "FAILED":
        return 0;
      default:
        return 0;
    }
  };

  const formatDuration = () => {
    const start = auditRun.startedAt ? new Date(auditRun.startedAt) : new Date(auditRun.createdAt);
    const end = auditRun.completedAt ? new Date(auditRun.completedAt) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) {
      return `${duration}s`;
    } else {
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Audit Status
          </div>
          <Badge variant={getStatusColor() as any}>
            {auditRun.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            {auditRun.target}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{getProgressValue()}%</span>
          </div>
          <Progress value={getProgressValue()} className="h-2" />
        </div>

        {/* Timeline */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(auditRun.createdAt).toLocaleTimeString()}</span>
          </div>
          
          {auditRun.startedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started:</span>
              <span>{new Date(auditRun.startedAt).toLocaleTimeString()}</span>
            </div>
          )}
          
          {auditRun.completedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed:</span>
              <span>{new Date(auditRun.completedAt).toLocaleTimeString()}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span>{formatDuration()}</span>
          </div>
        </div>

        {/* Summary */}
        {auditRun.summary && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">{auditRun.summary}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          {(auditRun.status === "COMPLETED" || auditRun.status === "SUCCEEDED") && (
            <Button
              size="sm"
              onClick={() => window.location.href = `/audit/${auditRun.id}`}
            >
              View Results
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {auditRun.status === "QUEUED" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Your audit is queued and will start shortly...
          </div>
        )}
        
        {auditRun.status === "RUNNING" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Analyzing meta tags and generating recommendations...
          </div>
        )}
        
        {auditRun.status === "FAILED" && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            Audit failed. Please try again or contact support.
          </div>
        )}
      </CardContent>
    </Card>
  );
}