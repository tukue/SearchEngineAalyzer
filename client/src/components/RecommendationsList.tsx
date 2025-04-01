import { Info } from "lucide-react";
import { Recommendation } from "@shared/schema";

type RecommendationsListProps = {
  recommendations: Recommendation[];
};

export default function RecommendationsList({ recommendations }: RecommendationsListProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Recommendations</h2>
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className="p-4 border border-orange-200 rounded-md bg-orange-50">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-secondary" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-slate-800">Add {rec.tagName} Meta Tag</h3>
                <div className="mt-2 text-sm text-slate-600">
                  <p>{rec.description}</p>
                  <pre className="mt-2 bg-slate-800 text-slate-200 p-3 rounded-md overflow-x-auto text-xs">
                    <code>{rec.example}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
