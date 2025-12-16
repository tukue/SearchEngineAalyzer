import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { AlertCircle, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface ReportSummaryProps {
  runId: string;
  url: string;
  overallScore: number;
  grade: string;
  categoryScores: {
    seo: number;
    social: number;
    technical: number;
  };
  totalFindings: number;
  criticalFindings: number;
  generatedAt: string;
  onClick?: () => void;
  compact?: boolean;
}

export function ReportSummary({
  runId,
  url,
  overallScore,
  grade,
  categoryScores,
  totalFindings,
  criticalFindings,
  generatedAt,
  onClick,
  compact = false
}: ReportSummaryProps) {
  const getGradeColor = (grade: string) => {
    const colors = {
      excellent: 'text-green-600 bg-green-50 border-green-200',
      good: 'text-lime-600 bg-lime-50 border-lime-200',
      fair: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      poor: 'text-orange-600 bg-orange-50 border-orange-200',
      critical: 'text-red-600 bg-red-50 border-red-200',
    };
    return colors[grade as keyof typeof colors] || colors.critical;
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (score >= 75) return <TrendingUp className="h-4 w-4 text-lime-500" />;
    if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch {
      return url;
    }
  };

  if (compact) {
    return (
      <Card 
        className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:bg-gray-50' : ''}`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getScoreIcon(overallScore)}
                <span className="font-medium text-sm truncate">{formatUrl(url)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{new Date(generatedAt).toLocaleDateString()}</span>
                <span>{totalFindings} issues</span>
                {criticalFindings > 0 && (
                  <Badge variant="destructive" className="text-xs px-1 py-0">
                    {criticalFindings} critical
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className={`text-lg font-bold ${getGradeColor(grade).split(' ')[0]}`}>
                  {overallScore}
                </div>
                <Badge className={`text-xs ${getGradeColor(grade)}`}>
                  {grade.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:bg-gray-50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate mb-1">{formatUrl(url)}</h3>
            <p className="text-sm text-gray-500">
              {new Date(generatedAt).toLocaleString()} • Run ID: {runId.slice(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getGradeColor(grade).split(' ')[0]}`}>
                {overallScore}
              </div>
              <Badge className={getGradeColor(grade)}>
                {grade.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-semibold mb-1">{categoryScores.seo}</div>
            <Progress value={categoryScores.seo} className="h-2 mb-1" />
            <p className="text-xs text-gray-600">SEO</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold mb-1">{categoryScores.social}</div>
            <Progress value={categoryScores.social} className="h-2 mb-1" />
            <p className="text-xs text-gray-600">Social</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold mb-1">{categoryScores.technical}</div>
            <Progress value={categoryScores.technical} className="h-2 mb-1" />
            <p className="text-xs text-gray-600">Technical</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              {totalFindings} total issues
            </span>
            {criticalFindings > 0 && (
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600 font-medium">
                  {criticalFindings} critical
                </span>
              </div>
            )}
          </div>
          {onClick && (
            <span className="text-blue-600 hover:text-blue-800">
              View Report →
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}