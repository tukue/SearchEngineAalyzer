"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HistoryIcon, RefreshCw, ExternalLink } from "lucide-react";
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Meta Tag Analyzer</h1>
            <p className="text-slate-600">Analyze and validate meta tags from any website</p>
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

        {/* URL Input Form */}
        <URLInputForm onSubmit={handleSubmit} isLoading={isPending} />

        {/* Loading State */}
        <LoadingState isVisible={isPending} />

        {/* Error State */}
        <ErrorState isVisible={isError} errorMessage={errorMessage} onRetry={handleRetry} />

        {/* Results Container */}
        <ResultsContainer isVisible={showResults} results={analysisResults} />

        {/* Getting Started (Shown when no analysis has been run) */}
        {!isPending && !isError && !showResults && <GettingStarted />}
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
