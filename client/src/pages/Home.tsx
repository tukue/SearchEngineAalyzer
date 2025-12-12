import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HistoryIcon, RefreshCw, ExternalLink, BarChart3, Settings } from "lucide-react";
import URLInputForm from "@/components/URLInputForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ResultsContainer from "@/components/ResultsContainer";
import GettingStarted from "@/components/GettingStarted";
import Dashboard from "@/components/Dashboard";
import HistoryManager from "@/components/HistoryManager";
import AuditStatusTracker from "@/components/AuditStatusTracker";
import { AnalysisResult } from "@shared/schema";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SearchHistoryItem = {
  url: string;
  timestamp: string;
};

export default function Home() {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState("audit");
  const [currentRunId, setCurrentRunId] = useState<number | undefined>(undefined);
  const { toast } = useToast();

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

  const { mutate, isPending, isError, error, reset } = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url });
      return res.json();
    },
    onSuccess: (data: { runId: number; jobId: string; status: string; target: string }) => {
      // Set the current run ID for status tracking
      setCurrentRunId(data.runId);
      setActiveTab("status");

      // Add to search history
      const newHistoryItem = {
        url: data.target,
        timestamp: new Date().toISOString(),
      };

      // Update history - keep only the 10 most recent searches
      const updatedHistory = [newHistoryItem, ...searchHistory.filter(item => item.url !== data.target)]
        .slice(0, 10);

      setSearchHistory(updatedHistory);

      // Save to localStorage
      localStorage.setItem('metaTagAnalyzerHistory', JSON.stringify(updatedHistory));

      toast({
        title: "Audit Queued",
        description: `Audit started for ${data.target}. Track progress in the Status tab.`,
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: err.message,
      });
    },
  });

  const handleSubmit = (url: string) => {
    setShowResults(false);
    setCurrentRunId(undefined);
    mutate(url);
  };

  const handleAuditComplete = (runId: number) => {
    // Fetch the completed audit results
    apiRequest("GET", `/api/audits/${runId}`)
      .then(res => res.json())
      .then(data => {
        if (data.analysis) {
          setAnalysisResults(data.analysis);
          setShowResults(true);
          setActiveTab("results");
        }
      })
      .catch(err => {
        console.error("Failed to fetch completed audit:", err);
      });
  };

  const handleViewAudit = (runId: number) => {
    // Navigate to audit results
    apiRequest("GET", `/api/audits/${runId}`)
      .then(res => res.json())
      .then(data => {
        if (data.analysis) {
          setAnalysisResults(data.analysis);
          setShowResults(true);
          setActiveTab("results");
        }
      })
      .catch(err => {
        toast({
          variant: "destructive",
          title: "Failed to Load Audit",
          description: err.message,
        });
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="container mx-auto px-4 py-10 max-w-6xl">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <p className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Multi-tenant ready · Queue-backed audits
              </p>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold text-slate-900">Meta Tag Analyzer</h1>
                <p className="max-w-2xl text-slate-600">
                  Run reliable meta-tag audits with tenant isolation, queued execution, and clear scoring. Paste any URL and get
                  prioritized fixes in seconds.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">Health score + prioritized fixes</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Recent runs & history</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Usage-aware queuing</span>
              </div>
            </div>

            <div className="mt-2 md:mt-0 flex gap-2">
              <Button
                variant={activeTab === "dashboard" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("dashboard")}
                className="h-10 shadow-sm"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 shadow-sm">
                    <HistoryIcon className="h-4 w-4 mr-2" />
                    Quick Access
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[300px]">
                  <DropdownMenuLabel>Recent Analyses</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {searchHistory.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-slate-500">
                      No search history yet
                    </div>
                  ) : (
                    <>
                      {searchHistory.slice(0, 5).map((item, i) => (
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
                      <DropdownMenuItem onClick={() => setActiveTab("history")}>
                        <HistoryIcon className="h-4 w-4 mr-2" />
                        <span>View All History</span>
                      </DropdownMenuItem>
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

          {/* Navigation Tabs */}
          <div className="mt-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="audit">New Audit</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>

              <TabsContent value="audit" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                  <div className="bg-white shadow-lg rounded-xl border border-slate-200/80 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Audit any public URL</p>
                        <h2 className="text-xl font-semibold text-slate-900">Start a new audit</h2>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Live</span>
                    </div>
                    <URLInputForm onSubmit={handleSubmit} isLoading={isPending} />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                        <p className="text-sm font-semibold text-slate-900">Queued + tenant scoped</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">History</p>
                        <p className="text-sm font-semibold text-slate-900">Recent runs & scores</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Limits</p>
                        <p className="text-sm font-semibold text-slate-900">Usage-aware gating</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow-lg rounded-xl border border-slate-200/80 p-5 flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">What you get</p>
                      <h3 className="text-lg font-semibold text-slate-900">Prioritized fixes</h3>
                      <p className="text-sm text-slate-600 mt-1">Health score, pass/fail groups, and top recommendations per run.</p>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700">
                      <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Tenant-isolated results</p>
                      <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> Download-ready data for exports</p>
                      <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> Top 5 fixes with impact & effort</p>
                      <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" /> Queue status: queued → running → done</p>
                    </div>
                  </div>
                </div>
                {!isPending && !isError && !showResults && <GettingStarted />}
              </TabsContent>

              <TabsContent value="status">
                <AuditStatusTracker runId={currentRunId} onComplete={handleAuditComplete} />
              </TabsContent>

              <TabsContent value="results">
                <ResultsContainer isVisible={showResults} results={analysisResults} />
              </TabsContent>

              <TabsContent value="history">
                <HistoryManager onViewAudit={handleViewAudit} />
              </TabsContent>

              <TabsContent value="dashboard">
                <Dashboard />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        {/* Loading State */}
        <LoadingState isVisible={isPending} />

        {/* Error State */}
        <ErrorState isVisible={isError} errorMessage={errorMessage} onRetry={handleRetry} />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-slate-500">© {new Date().getFullYear()} Meta Tag Analyzer</p>
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
    </div>
  );
}
