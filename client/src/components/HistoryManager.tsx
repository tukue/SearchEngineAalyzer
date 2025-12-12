import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Download, 
  Trash2, 
  ExternalLink,
  Calendar,
  Filter
} from "lucide-react";
import ExportDialog from "./ExportDialog";

interface AuditRun {
  id: number;
  target: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  createdAt: string;
  completedAt?: string;
  summary?: string;
  scores?: {
    overall: number;
    seo: number;
    social: number;
    technical: number;
  };
}

interface HistoryManagerProps {
  onViewAudit?: (runId: number) => void;
}

export default function HistoryManager({ onViewAudit }: HistoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedRunForExport, setSelectedRunForExport] = useState<AuditRun | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: runs, isLoading } = useQuery({
    queryKey: ["recent-runs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/recent-runs");
      return res.json() as Promise<{ runs: AuditRun[] }>;
    },
  });

  const { mutate: deleteRun } = useMutation({
    mutationFn: async (runId: number) => {
      await apiRequest("DELETE", `/api/audits/${runId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-runs"] });
      toast({
        title: "Audit Deleted",
        description: "The audit run has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    },
  });

  const filteredRuns = runs?.runs?.filter((run) => {
    const matchesSearch = run.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || run.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default">Completed</Badge>;
      case "RUNNING":
        return <Badge variant="secondary">Running</Badge>;
      case "QUEUED":
        return <Badge variant="outline">Queued</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScoreBadge = (score?: number) => {
    if (!score) return null;
    
    if (score >= 80) {
      return <Badge className="bg-green-100 text-green-800">Excellent ({score})</Badge>;
    } else if (score >= 60) {
      return <Badge className="bg-yellow-100 text-yellow-800">Good ({score})</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Needs Work ({score})</Badge>;
    }
  };

  const handleExport = (run: AuditRun) => {
    if (run.status !== "COMPLETED") {
      toast({
        variant: "destructive",
        title: "Cannot Export",
        description: "Only completed audits can be exported.",
      });
      return;
    }
    setSelectedRunForExport(run);
    setExportDialogOpen(true);
  };

  const handleDelete = (runId: number) => {
    if (confirm("Are you sure you want to delete this audit run? This action cannot be undone.")) {
      deleteRun(runId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
          <CardDescription>Loading your recent audit runs...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Audit History
            </div>
            <Badge variant="outline">
              {filteredRuns.length} {filteredRuns.length === 1 ? "run" : "runs"}
            </Badge>
          </CardTitle>
          <CardDescription>
            View and manage your recent audit runs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status: {statusFilter === "all" ? "All" : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("COMPLETED")}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("RUNNING")}>
                  Running
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("QUEUED")}>
                  Queued
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("FAILED")}>
                  Failed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Results Table */}
          {filteredRuns.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium truncate max-w-[300px]">
                            {run.target}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(run.status)}
                      </TableCell>
                      <TableCell>
                        {getScoreBadge(run.scores?.overall)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(run.createdAt).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">
                            {new Date(run.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onViewAudit?.(run.id)}
                              disabled={run.status !== "COMPLETED"}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Results
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExport(run)}
                              disabled={run.status !== "COMPLETED"}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export Report
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(run.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? (
                <div>
                  <p>No audit runs match your current filters.</p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div>
                  <p>No audit runs found.</p>
                  <p className="text-sm">Start your first audit to see results here.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      {selectedRunForExport && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          runId={selectedRunForExport.id}
          url={selectedRunForExport.target}
        />
      )}
    </>
  );
}