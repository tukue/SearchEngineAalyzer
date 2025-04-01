import { useState } from "react";
import { DownloadIcon, Search, MessageSquare, Code, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisResult } from "@shared/schema";
import TagsTable from "./TagsTable";
import RecommendationsList from "./RecommendationsList";

type ResultsContainerProps = {
  isVisible: boolean;
  results: AnalysisResult | null;
};

export default function ResultsContainer({ isVisible, results }: ResultsContainerProps) {
  const [activeTab, setActiveTab] = useState("all");

  if (!isVisible || !results) return null;

  const { analysis, tags, recommendations } = results;

  // Function to determine the color of the health score
  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-green-400";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 30) return "bg-orange-500";
    return "bg-red-500";
  };

  // Function to determine the health score label
  const getHealthScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Average";
    if (score >= 30) return "Needs Improvement";
    return "Poor";
  };
  
  // Function to get badge variant based on score
  const getScoreBadgeVariant = (score: number) => {
    if (score >= 70) return "default";
    if (score >= 50) return "secondary";
    if (score >= 30) return "outline";
    return "destructive";
  };

  // Function to filter tags based on active tab
  const getFilteredTags = () => {
    switch (activeTab) {
      case "seo":
        return tags.filter(tag => tag.tagType === "SEO");
      case "social":
        return tags.filter(tag => tag.tagType === "Social");
      case "technical":
        return tags.filter(tag => tag.tagType === "Technical");
      case "missing":
        return tags.filter(tag => !tag.isPresent);
      default:
        return tags;
    }
  };

  // Function to handle exporting results as JSON
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `meta-analysis-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div>
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Meta Tags Summary</h2>
            <p className="text-slate-600">{analysis.url}</p>
          </div>
          <div className="mt-3 sm:mt-0">
            <Button 
              variant="outline" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary bg-blue-50 hover:bg-blue-100"
              onClick={handleExport}
            >
              <DownloadIcon className="h-5 w-5 mr-2" />
              Export Results
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Tags Count */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-slate-500">Total Tags</h3>
                <p className="text-2xl font-semibold text-slate-800">{analysis.totalCount}</p>
              </div>
            </div>
          </div>

          {/* SEO Tags */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <Search className="h-6 w-6 text-success" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-slate-500">SEO Tags</h3>
                <p className="text-2xl font-semibold text-slate-800">{analysis.seoCount}</p>
              </div>
            </div>
          </div>

          {/* Social Tags */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <MessageSquare className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-slate-500">Social Tags</h3>
                <p className="text-2xl font-semibold text-slate-800">{analysis.socialCount}</p>
              </div>
            </div>
          </div>

          {/* Missing Tags */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <AlertTriangle className="h-6 w-6 text-secondary" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-slate-500">Missing Tags</h3>
                <p className="text-2xl font-semibold text-slate-800">{analysis.missingCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Health Score */}
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Meta Tags Health Score</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <Badge variant={getScoreBadgeVariant(analysis.healthScore)}>
                  {analysis.healthScore}%
                </Badge>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-slate-600">
                  {getHealthScoreLabel(analysis.healthScore)}
                </span>
              </div>
            </div>
            <Progress 
              value={analysis.healthScore} 
              className="h-2 bg-slate-200" 
              indicatorClassName={getHealthScoreColor(analysis.healthScore)}
            />
          </div>
        </div>
      </div>

      {/* Tag Categories Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <Tabs defaultValue="all" onValueChange={setActiveTab}>
          <div className="border-b border-slate-200">
            <TabsList className="flex">
              <TabsTrigger 
                value="all" 
                className="text-sm px-6 py-4 data-[state=active]:text-primary data-[state=active]:border-primary whitespace-nowrap data-[state=active]:border-b-2 font-medium"
              >
                All Tags
              </TabsTrigger>
              <TabsTrigger 
                value="seo" 
                className="text-sm px-6 py-4 data-[state=active]:text-primary data-[state=active]:border-primary whitespace-nowrap data-[state=active]:border-b-2 font-medium"
              >
                SEO
              </TabsTrigger>
              <TabsTrigger 
                value="social" 
                className="text-sm px-6 py-4 data-[state=active]:text-primary data-[state=active]:border-primary whitespace-nowrap data-[state=active]:border-b-2 font-medium"
              >
                Social Media
              </TabsTrigger>
              <TabsTrigger 
                value="technical" 
                className="text-sm px-6 py-4 data-[state=active]:text-primary data-[state=active]:border-primary whitespace-nowrap data-[state=active]:border-b-2 font-medium"
              >
                Technical
              </TabsTrigger>
              <TabsTrigger 
                value="missing" 
                className="text-sm px-6 py-4 data-[state=active]:text-secondary hover:text-secondary whitespace-nowrap data-[state=active]:border-secondary data-[state=active]:border-b-2 font-medium"
              >
                Missing Tags
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <TagsTable tags={getFilteredTags()} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <RecommendationsList recommendations={recommendations} />
      )}
    </div>
  );
}
