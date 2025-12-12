import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, Clock, CheckCircle, AlertTriangle, TrendingUp, Users } from "lucide-react";

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
                    <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
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
                          <Badge variant={run.score >= 80 ? "default" : run.score >= 60 ? "secondary" : "destructive"}>
                            Score: {run.score}
                          </Badge>
                        )}
                        <Badge variant="outline">{run.status}</Badge>
                      </div>
                    </div>
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
      </Tabs>
    </div>
  );
}