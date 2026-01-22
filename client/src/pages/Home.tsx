"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HistoryIcon, RefreshCw, ExternalLink, Download, Crown } from "lucide-react";
import URLInputForm from "@/components/URLInputForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ResultsContainer from "@/components/ResultsContainer";
import GettingStarted from "@/components/GettingStarted";
import { usePlanInfo, usePlanGatingErrorHandler, FeatureGate, PlanComparison } from "@/components/PlanGating";
import { AnalysisResult } from "@shared/schema";
import { UsageWidget } from "@/components/UsageWidget";
import { useUsageStatus } from "@/hooks/useUsageStatus";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SearchHistoryItem = {
  url: string;
  timestamp: string;
};

export default function Home() {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState("analyzer");
  const { toast } = useToast();
  const { planInfo, loading: planLoading, refetch: refetchPlan } = usePlanInfo();
  const { error: planError, handleError, ErrorComponent } = usePlanGatingErrorHandler();
  const { usage } = useUsageStatus();
  const queryClient = useQueryClient();

  const isLimitExceeded = usage?.warning_level === "exceeded";

  // Helper function for handling plan gating errors
  const handlePlanGatingError = (err: any, fallbackHandler: (err: any) => void) => {
    const errorData = err.response?.data || err;
    if (errorData?.code && ['PLAN_UPGRADE_REQUIRED', 'QUOTA_EXCEEDED', 'FEATURE_NOT_AVAILABLE'].includes(errorData.code)) {
      handleError(errorData);
    } else {
      fallbackHandler(err);
    }
  };

  // Load search history from localStorage when component mounts
  useEffect(() => {
    const storedHistory = localStorage.getItem('metaTagAnalyzerHistory');
    if (storedHistory) {
      try {
        setSearchHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse search history:", e);
        // If parsing fails, reset the history
        localStorage.removeItem('metaTagAnalyzerHistory');
      }
    }
  }, []);
  
  // Fetch analysis history from server
  const { data: serverHistory } = useQuery({
    queryKey: ['analysis-history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/history');
      return res.json();
    },
    enabled: !!planInfo
  });

  const { mutate, isPending, isError, error, reset } = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url });
      return res.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResults(data);
      setShowResults(true);
      queryClient.invalidateQueries({ queryKey: ["analysis-history"] });
      
      // Add to search history
      const newHistoryItem = {
        url: data.analysis.url,
        timestamp: new Date().toISOString(),
      };
      
      // Update history - keep only the 10 most recent searches
      const updatedHistory = [newHistoryItem, ...searchHistory.filter(item => item.url !== data.analysis.url)]
        .slice(0, 10);
      
      setSearchHistory(updatedHistory);
      
      // Save to localStorage
      localStorage.setItem('metaTagAnalyzerHistory', JSON.stringify(updatedHistory));
      
      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed meta tags for ${data.analysis.url}`,
      });
    },
    onError: (err: any) => {
      handlePlanGatingError(err, (err) => {
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: err.message || "An unexpected error occurred",
        });
      });
    },
  });

  const handleSubmit = (url: string) => {
    setShowResults(false);
    mutate(url);
  };
  
  // Export functionality
  const exportMutation = useMutation({
    mutationFn: async ({ analysisId, format }: { analysisId: number; format: string }) => {
      const res = await apiRequest('POST', `/api/export/${analysisId}`, { format });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: `Analysis exported as ${data.format.toUpperCase()}`,
      });
    },
    onError: (err: any) => {
      handlePlanGatingError(err, (err) => {
        toast({
          variant: "destructive",
          title: "Export Failed",
          description: err.message || "Failed to export analysis",
        });
      });
    }
  });
  
  const handleExport = (format: string) => {
    if (analysisResults) {
      exportMutation.mutate({ analysisId: analysisResults.analysis.id, format });
    }
  };

  const handleRetry = () => {
    reset();
  };
  
  const handleHistoryItemClick = (url: string) => {
    setShowResults(false);
    mutate(url);
  };
  
  const handleClearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('metaTagAnalyzerHistory');
    toast({
      title: "History Cleared",
      description: "Your search history has been cleared",
    });
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + 
      ' at ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

  const previousAnalysis = useMemo(() => {
    if (!analysisResults || !serverHistory?.analyses?.length) {
      return null;
    }

    const matching = serverHistory.analyses
      .filter((analysis: any) => analysis.url === analysisResults.analysis.url)
      .slice()
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (matching.length === 0) return null;

    const currentIndex = matching.findIndex((analysis: any) => analysis.id === analysisResults.analysis.id);
    if (currentIndex === -1) {
      return matching[0] ?? null;
    }

    return matching[currentIndex + 1] ?? null;
  }, [analysisResults, serverHistory]);

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Plan Gating Error Display */}
        {ErrorComponent && (
          <div className="mb-6">
            {ErrorComponent}
          </div>
        )}
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Meta Tag Analyzer</h1>
            <p className="text-slate-600">Analyze and validate meta tags from any website</p>
            {planInfo && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={planInfo.currentPlan === 'pro' ? 'default' : 'secondary'}>
                  {planInfo.currentPlan === 'pro' && <Crown className="h-3 w-3 mr-1" />}
                  {planInfo.currentPlan.toUpperCase()} Plan
                </Badge>
                <span className="text-sm text-slate-500">
                  {planInfo.entitlements.monthlyAuditLimit} audits/month • {planInfo.entitlements.historyDepth} history depth
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-4 md:mt-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <HistoryIcon className="h-4 w-4 mr-2" />
                  Search History
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[280px]">
                <DropdownMenuLabel>Recent Analyses</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {searchHistory.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-slate-500">
                    No search history yet
                  </div>
                ) : (
                  <>
                    {searchHistory.map((item, i) => (
                      <DropdownMenuItem key={i} onClick={() => handleHistoryItemClick(item.url)}>
                        <div className="flex flex-col w-full">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm font-medium truncate max-w-[180px]">{item.url}</span>
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </div>
                          <span className="text-xs text-slate-500">{formatDate(item.timestamp)}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearHistory}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      <span>Clear History</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="plan">Plan & Billing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="analyzer" className="space-y-6">
            {/* Usage Widget */}
            <UsageWidget />

            {/* URL Input Form */}
            <URLInputForm 
              onSubmit={handleSubmit} 
              isLoading={isPending} 
              disabled={isLimitExceeded}
            />

            {/* Loading State */}
            <LoadingState isVisible={isPending} />

            {/* Error State */}
            <ErrorState isVisible={isError} errorMessage={errorMessage} onRetry={handleRetry} />

            {/* Results Container with Export */}
            {showResults && analysisResults && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Analysis Results</h2>
                  <FeatureGate 
                    feature="Export" 
                    enabled={planInfo?.entitlements.exportsEnabled || false}
                    fallback={
                      <Button disabled variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export (Pro Only)
                      </Button>
                    }
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={exportMutation.isPending}>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleExport('json')}>
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('pdf')}>
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('html')}>
                          Export as HTML
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </FeatureGate>
                </div>
                <ResultsContainer
                  isVisible={true}
                  results={analysisResults}
                  previousAnalysis={previousAnalysis}
                />
              </div>
            )}

            {/* Getting Started (Shown when no analysis has been run) */}
            {!isPending && !isError && !showResults && <GettingStarted />}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analysis History</CardTitle>
                <CardDescription>
                  {planInfo && (
                    <>Showing last {planInfo.entitlements.historyDepth} analyses (plan limit)</>  
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {serverHistory?.analyses?.length > 0 ? (
                  <div className="space-y-2">
                    {serverHistory.analyses.map((analysis: any, index: number) => (
                      <div key={analysis.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{analysis.url}</p>
                          <p className="text-sm text-slate-500">
                            Score: {analysis.healthScore}% • {new Date(analysis.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleHistoryItemClick(analysis.url)}
                        >
                          Re-analyze
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No analysis history yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="plan" className="space-y-6">
            {planInfo && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>Manage your subscription and view usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{planInfo.entitlements.monthlyAuditLimit}</p>
                        <p className="text-sm text-slate-500">Monthly Audits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{planInfo.entitlements.historyDepth}</p>
                        <p className="text-sm text-slate-500">History Depth</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{planInfo.entitlements.exportsEnabled ? '✓' : '✗'}</p>
                        <p className="text-sm text-slate-500">Exports</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{planInfo.entitlements.apiAccessEnabled ? '✓' : '✗'}</p>
                        <p className="text-sm text-slate-500">API Access</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <PlanComparison currentPlan={planInfo.currentPlan} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-slate-500">© {new Date().getFullYear()} Meta Tag Analyzer</p>
              {planInfo && (
                <p className="text-xs text-slate-400">Tenant ID: {planInfo.tenantId}</p>
              )}
            </div>
            <div>
              <ul className="flex space-x-6">
                <li>
                  <a href="#" className="text-sm text-slate-500 hover:text-primary">Help</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-slate-500 hover:text-primary">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-slate-500 hover:text-primary">Terms of Service</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
