import { useState, useMemo } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisResult } from "@shared/schema";
import TagsTable from "./TagsTable";
import RecommendationsList from "./RecommendationsList";
import { HealthSummaryCard } from "./HealthSummaryCard";
import { TopIssues } from "./TopIssues";
import { computeHealthSummary, computeTopIssues } from "@/lib/analysis-utils";

type ResultsContainerProps = {
  isVisible: boolean;
  results: AnalysisResult | null;
};

export default function ResultsContainer({ isVisible, results }: ResultsContainerProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [showAllTags, setShowAllTags] = useState(false);

  const { healthSummary, topIssues } = useMemo(() => {
    if (!results) return { healthSummary: null, topIssues: [] };
    return {
      healthSummary: computeHealthSummary(results.tags),
      topIssues: computeTopIssues(results.tags)
    };
  }, [results]);

  if (!isVisible || !results || !healthSummary) return null;

  const { analysis, tags, recommendations } = results;

  // Function to filter tags based on active tab and showAllTags toggle
  const getFilteredTags = () => {
    let filtered = tags;

    // First filter by tab
    switch (activeTab) {
      case "seo":
        filtered = tags.filter(tag => tag.tagType === "SEO");
        break;
      case "social":
        filtered = tags.filter(tag => tag.tagType === "Social");
        break;
      case "technical":
        filtered = tags.filter(tag => tag.tagType === "Technical");
        break;
      case "missing":
        filtered = tags.filter(tag => !tag.isPresent);
        break;
      default:
        // "all" - no category filter
        break;
    }

    // Then filter by showAllTags toggle (unless we are in "missing" tab which implies showing issues)
    if (!showAllTags && activeTab !== "missing") {
      filtered = filtered.filter(tag => {
        const isMissing = !tag.isPresent || tag.content === "Missing";
        const isInvalid = !isMissing && (!tag.content || tag.content.trim() === "");
        return isMissing || isInvalid;
      });
    }

    return filtered;
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
    <div className="space-y-8">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Analysis Results</h2>
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

      {/* Health Summary */}
      <HealthSummaryCard summary={healthSummary} />

      {/* Top Issues */}
      <TopIssues issues={topIssues} />

      {/* Tag Categories Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Tabs defaultValue="all" onValueChange={setActiveTab}>
          <div className="border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center pr-4">
            <TabsList className="flex overflow-x-auto w-full sm:w-auto">
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

            {/* Show All Toggle */}
            {activeTab !== "missing" && (
              <div className="flex items-center space-x-2 py-2 sm:py-0">
                <Switch 
                  id="show-all-tags" 
                  checked={showAllTags}
                  onCheckedChange={setShowAllTags}
                />
                <Label htmlFor="show-all-tags" className="text-sm text-slate-600 cursor-pointer">
                  Show all tags
                </Label>
              </div>
            )}
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <TagsTable tags={getFilteredTags()} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Recommendations Section (Legacy/Detailed) */}
      {recommendations.length > 0 && (
        <RecommendationsList recommendations={recommendations} />
      )}

    </div>
  );
}
