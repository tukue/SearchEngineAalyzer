import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HistoryIcon, RefreshCw, ExternalLink, Sparkles, ShieldCheck, Clock } from "lucide-react";
import URLInputForm from "@/components/URLInputForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ResultsContainer from "@/components/ResultsContainer";
import GettingStarted from "@/components/GettingStarted";
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

type SearchHistoryItem = {
  url: string;
  timestamp: string;
};

export default function Home() {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
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
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResults(data);
      setShowResults(true);
      
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
    mutate(url);
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
    <>
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div className="container mx-auto px-4 pt-10 pb-6 max-w-6xl">
          {/* Hero */}
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8 items-start mb-10">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white shadow-sm border border-slate-200 px-3 py-1 text-sm text-slate-600">
                <Sparkles className="h-4 w-4 text-primary" />
                Start your web audit in one step
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
                  Enter a website, get an actionable audit in seconds.
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl">
                  Paste any URL to see SEO, social, and technical meta tag coverage with prioritized fixes.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Tenant Safe
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Scoped audits keep your data isolated per workspace.</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Queue Backed
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Jobs run async with retries so results stay reliable.</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <HistoryIcon className="h-4 w-4 text-indigo-500" />
                    Remembered
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Recent URLs stay in your history for quick re-runs.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 p-6">
              <header className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Step 1</p>
                  <h2 className="text-xl font-semibold text-slate-900">Enter a website to audit</h2>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <HistoryIcon className="h-4 w-4 mr-2" />
                      History
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
              </header>

              <div className="space-y-4">
                <URLInputForm onSubmit={handleSubmit} isLoading={isPending} />
                <p className="text-sm text-slate-500">
                  We run your audit in the background, capture meta tags, and return prioritized fixes for SEO, social, and technical health.
                </p>
              </div>
            </div>
          </div>

          {/* Results + States */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Latest audit</h3>
            <LoadingState isVisible={isPending} />
            <ErrorState isVisible={isError} errorMessage={errorMessage} onRetry={handleRetry} />
            <ResultsContainer isVisible={showResults} results={analysisResults} />
            {!isPending && !isError && !showResults && <GettingStarted />}
          </div>
        </div>
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
    </>
  );
}
