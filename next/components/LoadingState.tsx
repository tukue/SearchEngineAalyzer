import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  isVisible: boolean;
};

export default function LoadingState({ isVisible }: LoadingStateProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-8 mb-8">
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-1">Analyzing meta tags...</h3>
        <p className="text-sm text-slate-500">This may take a few seconds</p>
      </div>
    </div>
  );
}
