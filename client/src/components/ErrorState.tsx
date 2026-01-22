import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  isVisible: boolean;
  errorMessage: string;
  onRetry: () => void;
};

export default function ErrorState({ isVisible, errorMessage, onRetry }: ErrorStateProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-md bg-red-50 border border-red-200">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-12 w-12 text-error" />
        </div>
        <div className="flex-grow text-center sm:text-left">
          <h3 className="text-lg font-medium text-slate-800 mb-1">Unable to analyze meta tags</h3>
          <p className="text-sm text-slate-600 mb-4">
            {errorMessage || "We couldn't access the website. Please check the URL and try again."}
          </p>
          <Button
            variant="caution"
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
