import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Download, Filter, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ReportViewModel, ReportFilters } from '@shared/report-schema';

interface ReportViewProps {
  runId: string;
  onExport?: (format: 'pdf' | 'html') => void;
  exportLoading?: boolean;
}

export function ReportView({ runId, onExport, exportLoading }: ReportViewProps) {
  const [report, setReport] = useState<ReportViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [runId, filters]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (Object.keys(filters).length > 0) {
        queryParams.set('filters', JSON.stringify(filters));
      }
      
      const response = await fetch(`/api/reports/${runId}?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }
      
      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, values: string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: values.length > 0 ? values : undefined,
    }));
  };

  const getGradeColor = (grade: string) => {
    const colors = {
      excellent: 'text-green-600 bg-green-50',
      good: 'text-lime-600 bg-lime-50',
      fair: 'text-yellow-600 bg-yellow-50',
      poor: 'text-orange-600 bg-orange-50',
      critical: 'text-red-600 bg-red-50',
    };
    return colors[grade as keyof typeof colors] || colors.critical;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">Failed to load report</p>
          <p className="text-gray-600 text-sm mt-2">{error}</p>
          <Button onClick={fetchReport} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Report</h1>
          <p className="text-gray-600 text-sm mt-1">
            {report.metadata.url} • {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          {onExport && (
            <Select onValueChange={(format) => onExport(format as 'pdf' | 'html')}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Categories</label>
                <div className="space-y-2">
                  {['seo', 'social', 'technical'].map(category => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={category}
                        checked={filters.categories?.includes(category) || false}
                        onCheckedChange={(checked) => {
                          const current = filters.categories || [];
                          const updated = checked
                            ? [...current, category]
                            : current.filter(c => c !== category);
                          handleFilterChange('categories', updated);
                        }}
                      />
                      <label htmlFor={category} className="text-sm capitalize">
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Severities</label>
                <div className="space-y-2">
                  {['critical', 'high', 'medium', 'low', 'info'].map(severity => (
                    <div key={severity} className="flex items-center space-x-2">
                      <Checkbox
                        id={severity}
                        checked={filters.severities?.includes(severity) || false}
                        onCheckedChange={(checked) => {
                          const current = filters.severities || [];
                          const updated = checked
                            ? [...current, severity]
                            : current.filter(s => s !== severity);
                          handleFilterChange('severities', updated);
                        }}
                      />
                      <label htmlFor={severity} className="text-sm capitalize">
                        {severity}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <div className="space-y-2">
                  {['pass', 'fail', 'warn'].map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={status}
                        checked={filters.statuses?.includes(status) || false}
                        onCheckedChange={(checked) => {
                          const current = filters.statuses || [];
                          const updated = checked
                            ? [...current, status]
                            : current.filter(s => s !== status);
                          handleFilterChange('statuses', updated);
                        }}
                      />
                      <label htmlFor={status} className="text-sm capitalize">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className={`text-4xl font-bold mb-2 ${getGradeColor(report.healthScore.grade).split(' ')[0]}`}>
              {report.healthScore.overall}
            </div>
            <Badge className={getGradeColor(report.healthScore.grade)}>
              {report.healthScore.grade.toUpperCase()}
            </Badge>
            <p className="text-sm text-gray-600 mt-2">Overall Score</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold mb-2">{report.healthScore.categoryScores.seo}</div>
            <Progress value={report.healthScore.categoryScores.seo} className="mb-2" />
            <p className="text-sm text-gray-600">SEO Score</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold mb-2">{report.healthScore.categoryScores.social}</div>
            <Progress value={report.healthScore.categoryScores.social} className="mb-2" />
            <p className="text-sm text-gray-600">Social Score</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold mb-2">{report.healthScore.categoryScores.technical}</div>
            <Progress value={report.healthScore.categoryScores.technical} className="mb-2" />
            <p className="text-sm text-gray-600">Technical Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Priority Fixes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Top Priority Fixes ({report.topFixes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.topFixes.map((fix) => (
              <div key={fix.finding.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      #{fix.rank}
                    </Badge>
                    <h3 className="font-medium">{fix.finding.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(fix.finding.severity)}
                    <Badge variant={fix.finding.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {fix.finding.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-3">{fix.finding.message}</p>
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm"><strong>How to fix:</strong> {fix.finding.guidance}</p>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>Impact: {fix.impactScore}/100</span>
                  <span>Effort: {fix.effortScore}/100</span>
                  <span>Category: {fix.finding.category.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Findings */}
      <Card>
        <CardHeader>
          <CardTitle>All Findings ({report.findings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({report.findings.length})</TabsTrigger>
              <TabsTrigger value="seo">SEO ({report.categoryCounts.seo.total})</TabsTrigger>
              <TabsTrigger value="social">Social ({report.categoryCounts.social.total})</TabsTrigger>
              <TabsTrigger value="technical">Technical ({report.categoryCounts.technical.total})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-3 mt-4">
              {report.findings.map((finding) => (
                <div key={finding.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{finding.title}</h4>
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(finding.severity)}
                      <Badge variant="outline" className="text-xs">
                        {finding.category.toUpperCase()}
                      </Badge>
                      <Badge variant={finding.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {finding.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{finding.message}</p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm"><strong>How to fix:</strong> {finding.guidance}</p>
                    <p className="text-sm mt-1"><strong>Why it matters:</strong> {finding.impact}</p>
                  </div>
                </div>
              ))}
            </TabsContent>
            
            {['seo', 'social', 'technical'].map(category => (
              <TabsContent key={category} value={category} className="space-y-3 mt-4">
                {report.findings
                  .filter(finding => finding.category === category)
                  .map((finding) => (
                    <div key={finding.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{finding.title}</h4>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(finding.severity)}
                          <Badge variant={finding.severity === 'critical' ? 'destructive' : 'secondary'}>
                            {finding.severity.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{finding.message}</p>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm"><strong>How to fix:</strong> {finding.guidance}</p>
                        <p className="text-sm mt-1"><strong>Why it matters:</strong> {finding.impact}</p>
                      </div>
                    </div>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}