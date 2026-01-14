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
  const { toast } = useToast();

  const { mutate, isPending, isError, error, reset } = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url });
      return res.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResults(data);
      toast({
        title: "Analysis Complete",
        description: `We analyzed ${data.analysis.url} and prepared recommendations.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: err.message || "An unexpected error occurred",
      });
    },
  });

  const handleSubmit = (url: string) => {
    setAnalysisResults(null);
    mutate(url);
  };

  const handleRetry = () => {
    reset();
  };

  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Website Analyzer MVP</p>
          <h1 className="text-3xl font-bold text-slate-800 mt-2">Website Analyzer</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Enter any website URL to scan its meta tags and receive clear, actionable improvements
            for SEO, social sharing, and technical metadata.
          </p>
        </header>

        <URLInputForm onSubmit={handleSubmit} isLoading={isPending} />

        <LoadingState isVisible={isPending} />

        <ErrorState isVisible={isError} errorMessage={errorMessage} onRetry={handleRetry} />

        {analysisResults && !isPending && !isError && (
          <ResultsContainer isVisible={true} results={analysisResults} />
        )}

        {!analysisResults && !isPending && !isError && <GettingStarted />}
      </div>

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-slate-500">© {new Date().getFullYear()} Website Analyzer</p>
              <p className="text-xs text-slate-400">Simple, fast, and focused on essential meta-tag insights.</p>
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
