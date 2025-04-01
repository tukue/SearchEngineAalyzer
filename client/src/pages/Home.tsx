import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import URLInputForm from "@/components/URLInputForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ResultsContainer from "@/components/ResultsContainer";
import GettingStarted from "@/components/GettingStarted";
import { AnalysisResult } from "@shared/schema";

export default function Home() {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const { mutate, isPending, isError, error, reset } = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url });
      return res.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResults(data);
      setShowResults(true);
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

  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Meta Tag Analyzer</h1>
          <p className="text-slate-600">Analyze and validate meta tags from any website</p>
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
