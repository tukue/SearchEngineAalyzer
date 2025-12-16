import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Clock, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Download } from 'lucide-react';

// Types
interface DashboardRun {
  runId: string;
  projectName: string;
  auditName: string;
  status: string;
  overallScore: number;
  startedAt: string;
  duration: number | null;
  findingsCount: number;
}

interface RunDetails {
  runId: string;
  projectName: string;
  auditName: string;
  status: string;
  summary: {
    scores: {
      overall: number;
      seo: number;
      performance: number;
      accessibility: number;
    };
    counts: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    metadata: {
      url: string;
      loadTime?: number;
      pageSize?: number;
    };
  };
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  findings: Array<{
    id: number;
    category: string;
    severity: string;
    ruleId: string;
    title: string;
    message: string;
    guidance: string;
    impact: string;
    element: string | null;
  }>;
  artifacts?: Array<{
    id: number;
    type: string;
    filename: string;
    size: number;
    downloadUrl?: string;
  }>;
}

// Dashboard component showing recent runs
export function Dashboard() {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard-runs'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/runs?limit=10');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error loading dashboard</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Audit Runs</CardTitle>
        <CardDescription>
          Last {dashboardData?.runs?.length || 0} runs across all projects
          {dashboardData?.planLimit && (
            <span className="ml-2 text-sm">
              (Plan limit: {dashboardData.planLimit})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {dashboardData?.runs?.map((run: DashboardRun) => (
              <RunCard key={run.runId} run={run} />
            ))}
            {(!dashboardData?.runs || dashboardData.runs.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No audit runs yet. Start your first audit to see results here.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Individual run card component
function RunCard({ run }: { run: DashboardRun }) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (duration: number | null) => {
    if (!duration) return 'N/A';
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon(run.status)}
          <div>
            <div className="font-medium">{run.projectName}</div>
            <div className="text-sm text-gray-500">{run.auditName}</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className={`font-bold ${getScoreColor(run.overallScore)}`}>
              {run.overallScore}%
            </div>
            <div className="text-xs text-gray-500">
              {run.findingsCount} issues
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm">
              {new Date(run.startedAt).toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-500">
              {formatDuration(run.duration)}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Details'}
          </Button>
        </div>
      </div>
      
      {showDetails && (
        <div className="mt-4 pt-4 border-t">
          <RunDetailsView runId={run.runId} />
        </div>
      )}
    </div>
  );
}

// Detailed run view component
function RunDetailsView({ runId }: { runId: string }) {
  const { data: runDetails, isLoading, error } = useQuery({
    queryKey: ['run-details', runId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/runs/${runId}`);
      return res.json();
    },
  });

  if (isLoading) return <div>Loading run details...</div>;
  if (error) return <div>Error loading run details</div>;
  if (!runDetails) return <div>Run not found</div>;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'info': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Scores */}
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {runDetails.summary.scores.overall}%
          </div>
          <div className="text-sm text-gray-500">Overall</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {runDetails.summary.scores.seo}%
          </div>
          <div className="text-sm text-gray-500">SEO</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {runDetails.summary.scores.performance}%
          </div>
          <div className="text-sm text-gray-500">Performance</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {runDetails.summary.scores.accessibility}%
          </div>
          <div className="text-sm text-gray-500">Accessibility</div>
        </div>
      </div>

      <Separator />

      {/* Findings */}
      <div>
        <h4 className="font-semibold mb-3">
          Findings ({runDetails.findings.length})
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {runDetails.findings.map((finding) => (
            <div key={finding.id} className="border rounded p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge className={getSeverityColor(finding.severity)}>
                      {finding.severity}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {finding.category}
                    </span>
                  </div>
                  <div className="font-medium">{finding.title}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {finding.message}
                  </div>
                  <div className="text-sm text-blue-600 mt-1">
                    💡 {finding.guidance}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Artifacts */}
      {runDetails.artifacts && runDetails.artifacts.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="font-semibold mb-3">
              Artifacts ({runDetails.artifacts.length})
            </h4>
            <div className="space-y-2">
              {runDetails.artifacts.map((artifact) => (
                <div key={artifact.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{artifact.filename}</div>
                    <div className="text-sm text-gray-500">
                      {artifact.type} • {(artifact.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  {artifact.downloadUrl && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Project management component
export function ProjectManager() {
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectUrl, setNewProjectUrl] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/projects');
      return res.json();
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; url: string }) => {
      const res = await apiRequest('POST', '/api/projects', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNewProjectName('');
      setNewProjectUrl('');
    },
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName && newProjectUrl) {
      createProjectMutation.mutate({
        name: newProjectName,
        url: newProjectUrl,
      });
    }
  };

  if (isLoading) return <div>Loading projects...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>Manage your audit projects</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateProject} className="space-y-4 mb-6">
          <div>
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <input
              type="url"
              placeholder="Project URL"
              value={newProjectUrl}
              onChange={(e) => setNewProjectUrl(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <Button 
            type="submit" 
            disabled={createProjectMutation.isPending}
          >
            {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
          </Button>
        </form>

        <div className="space-y-2">
          {projects?.projects?.map((project: any) => (
            <div key={project.id} className="border rounded p-3">
              <div className="font-medium">{project.name}</div>
              <div className="text-sm text-gray-500">{project.url}</div>
              <div className="text-xs text-gray-400">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Trends component showing score changes over time
export function TrendsView({ projectId }: { projectId?: number }) {
  const { data: runsData } = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: async () => {
      const endpoint = projectId 
        ? `/api/projects/${projectId}/runs?limit=10`
        : '/api/dashboard/runs?limit=10';
      const res = await apiRequest('GET', endpoint);
      return res.json();
    },
    enabled: !!projectId,
  });

  if (!runsData?.runs || runsData.runs.length < 2) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            Need at least 2 runs to show trends
          </div>
        </CardContent>
      </Card>
    );
  }

  const runs = runsData.runs;
  const latest = runs[0];
  const previous = runs[1];
  const scoreChange = latest.overallScore - previous.overallScore;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className="text-3xl font-bold">
            {latest.overallScore}%
          </div>
          <div className="flex items-center space-x-1">
            {scoreChange > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : scoreChange < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <span className={`text-sm ${
              scoreChange > 0 ? 'text-green-600' : 
              scoreChange < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-500 mt-2">
          vs previous run ({new Date(previous.startedAt).toLocaleDateString()})
        </div>
      </CardContent>
    </Card>
  );
}