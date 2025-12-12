import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Activity, Clock, CheckCircle, AlertTriangle, TrendingUp, Users, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageScore: number;
  trendsData: Array<{ date: string; score: number; runs: number }>;
  recentRuns: Array<{
    id: number;
    url: string;
    status: string;
    score?: number;
    createdAt: string;
  }>;
}

interface PlanInfo {
  plan: string;
  remainingRuns: number;
  maxMonthlyRuns: number;
  maxHistoryLength: number;
  canExport: boolean;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard/stats");
      return res.json() as Promise<DashboardStats>;
    },
  });

  const { data: planInfo, isLoading: planLoading } = useQuery({
    queryKey: ["plan-info"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/plan");
      return res.json() as Promise<PlanInfo>;
    },
  });

  const [selectedAudit, setSelectedAudit] = useState<number | null>(null);
  const [auditDetails, setAuditDetails] = useState<any>(null);

  const fetchAuditDetails = async (runId: number) => {
    try {
      const res = await apiRequest("GET", `/api/audits/${runId}`);
      const data = await res.json();
      setAuditDetails(data.analysis);
      setSelectedAudit(runId);
    } catch (error) {
      console.error('Failed to fetch audit details:', error);
    }
  };

  if (statsLoading || planLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const usagePercentage = planInfo ? ((planInfo.maxMonthlyRuns - planInfo.remainingRuns) / planInfo.maxMonthlyRuns) * 100 : 0;
  const successRate = stats ? (stats.successfulRuns / stats.totalRuns) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRuns || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.successfulRuns || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.failedRuns || 0} failed audits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.averageScore?.toFixed(1) || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              Across all audits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planInfo?.remainingRuns || 0}</div>
            <p className="text-xs text-muted-foreground">
              runs remaining this month
            </p>
            <Progress value={usagePercentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Plan
            <Badge variant={planInfo?.plan === "Pro" ? "default" : "secondary"}>
              {planInfo?.plan || "Free"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Your current subscription and usage limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium">Monthly Runs</p>
              <p className="text-2xl font-bold">{planInfo?.maxMonthlyRuns || 0}</p>
              <p className="text-xs text-muted-foreground">
                {planInfo?.remainingRuns || 0} remaining
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">History Length</p>
              <p className="text-2xl font-bold">{planInfo?.maxHistoryLength || 0}</p>
              <p className="text-xs text-muted-foreground">recent runs stored</p>
            </div>
            <div>
              <p className="text-sm font-medium">Export Access</p>
              <p className="text-2xl font-bold">
                {planInfo?.canExport ? "✓" : "✗"}
              </p>
              <p className="text-xs text-muted-foreground">
                {planInfo?.canExport ? "PDF/HTML exports" : "Upgrade for exports"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and Recent Activity */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
          <TabsTrigger value="results">Audit Results</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trends</CardTitle>
              <CardDescription>
                Your audit scores and frequency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.trendsData && stats.trendsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Average Score"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="runs" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Number of Runs"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No trend data available yet. Run more audits to see trends.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Audits</CardTitle>
              <CardDescription>
                Your latest audit runs and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentRuns && stats.recentRuns.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentRuns.map((run) => (
                    <AuditResultCard key={run.id} run={run} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No recent audits found. Start your first audit to see results here.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <AuditResultsVisualization stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditResultCard({ run }: { run: any }) {
  const [showDetails, setShowDetails] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  const fetchDetails = async () => {
    try {
      const res = await apiRequest("GET", `/api/audits/${run.id}`);
      const data = await res.json();
      setAuditData(data.analysis);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to fetch details:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const tagData = auditData ? [
    { name: 'SEO', value: auditData.analysis.seoCount, color: '#3b82f6' },
    { name: 'Social', value: auditData.analysis.socialCount, color: '#10b981' },
    { name: 'Technical', value: auditData.analysis.technicalCount, color: '#f59e0b' },
    { name: 'Missing', value: auditData.analysis.missingCount, color: '#ef4444' }
  ] : [];

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${
            run.status === "COMPLETED" ? "bg-green-500" :
            run.status === "FAILED" ? "bg-red-500" :
            "bg-yellow-500"
          }`} />
          <div>
            <p className="font-medium truncate max-w-[300px]">{run.url}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(run.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run.score && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(run.score)}`}>
                {run.score}%
              </div>
              <Progress value={run.score} className="w-20 h-2" />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={fetchDetails}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </div>

      {showDetails && auditData && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tag Distribution Chart */}
            <div>
              <h4 className="font-medium mb-2">Tag Distribution</h4>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tagData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={50}
                      dataKey="value"
                    >
                      {tagData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tag Counts */}
            <div>
              <h4 className="font-medium mb-2">Tag Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">SEO Tags:</span>
                  <Badge variant="outline">{auditData.analysis.seoCount}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Social Tags:</span>
                  <Badge variant="outline">{auditData.analysis.socialCount}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Technical Tags:</span>
                  <Badge variant="outline">{auditData.analysis.technicalCount}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-red-600">Missing Tags:</span>
                  <Badge variant="destructive">{auditData.analysis.missingCount}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations Preview */}
          {auditData.recommendations && auditData.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Top Recommendations</h4>
              <div className="space-y-2">
                {auditData.recommendations.slice(0, 3).map((rec: any, index: number) => (
                  <div key={index} className="text-sm p-2 bg-white rounded border">
                    <span className="font-medium text-blue-600">{rec.tagName}:</span>
                    <span className="ml-2">{rec.description}</span>
                  </div>
                ))}
                {auditData.recommendations.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{auditData.recommendations.length - 3} more recommendations
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              Total Tags: {auditData.analysis.totalCount}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDetails(false)}>
              Hide Details
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditResultsVisualization({ stats }: { stats: DashboardStats | undefined }) {
  if (!stats || !stats.recentRuns.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No audit results to display</p>
            <p className="text-sm">Run your first audit to see visual results here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreDistribution = stats.recentRuns
    .filter(run => run.score)
    .reduce((acc, run) => {
      const range = run.score! >= 80 ? 'Excellent (80-100)' :
                   run.score! >= 60 ? 'Good (60-79)' :
                   run.score! >= 40 ? 'Fair (40-59)' : 'Poor (0-39)';
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const chartData = Object.entries(scoreDistribution).map(([range, count]) => ({
    range,
    count,
    color: range.includes('Excellent') ? '#10b981' :
           range.includes('Good') ? '#3b82f6' :
           range.includes('Fair') ? '#f59e0b' : '#ef4444'
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
          <CardDescription>How your audits perform across different score ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>Key metrics from your recent audits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {stats.recentRuns.filter(r => r.score && r.score >= 80).length}
              </div>
              <div className="text-sm text-green-700">Excellent Scores</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.recentRuns.filter(r => r.score && r.score >= 60 && r.score < 80).length}
              </div>
              <div className="text-sm text-blue-700">Good Scores</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.recentRuns.filter(r => r.score && r.score >= 40 && r.score < 60).length}
              </div>
              <div className="text-sm text-yellow-700">Fair Scores</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {stats.recentRuns.filter(r => r.score && r.score < 40).length}
              </div>
              <div className="text-sm text-red-700">Poor Scores</div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Average Score</span>
              <span className="text-lg font-bold">{stats.averageScore?.toFixed(1) || 'N/A'}</span>
            </div>
            <Progress value={stats.averageScore || 0} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}