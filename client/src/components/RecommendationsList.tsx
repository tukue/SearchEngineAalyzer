import { Info, Star, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Recommendation } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type RecommendationsListProps = {
  recommendations: Recommendation[];
};

export default function RecommendationsList({ recommendations }: RecommendationsListProps) {
  const [pinnedRecs, setPinnedRecs] = useState<number[]>([]);
  const { toast } = useToast();

  if (recommendations.length === 0) return null;

  // Handle pinning a recommendation
  const togglePin = (index: number) => {
    if (pinnedRecs.includes(index)) {
      setPinnedRecs(pinnedRecs.filter(i => i !== index));
    } else {
      setPinnedRecs([...pinnedRecs, index]);
    }
  };

  // Handle copying code
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => {
        toast({
          title: "Code copied",
          description: "Tag code has been copied to clipboard",
          duration: 2000,
        });
      },
      (err) => {
        toast({
          variant: "destructive",
          title: "Failed to copy code",
          description: "Please try again or copy manually",
          duration: 2000,
        });
      }
    );
  };

  // Sort recommendations so pinned ones come first
  const sortedRecs = [...recommendations].sort((a, b) => {
    const aIndex = recommendations.indexOf(a);
    const bIndex = recommendations.indexOf(b);
    const aPinned = pinnedRecs.includes(aIndex);
    const bPinned = pinnedRecs.includes(bIndex);
    
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Recommendations</h2>
      <p className="text-slate-600 mb-6">Based on our analysis, here are some improvements you can make to your meta tags:</p>
      <div className="space-y-4">
        {sortedRecs.map((rec, index) => {
          const origIndex = recommendations.indexOf(rec);
          const isPinned = pinnedRecs.includes(origIndex);
          
          return (
            <div 
              key={index} 
              className={`p-4 border rounded-md transition-all duration-200 ${
                isPinned 
                  ? "border-yellow-300 bg-yellow-50 shadow-sm" 
                  : "border-orange-200 bg-orange-50"
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-secondary" />
                </div>
                <div className="ml-3 flex-grow">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-slate-800">
                      Add {rec.tagName} Meta Tag
                      {isPinned && <Badge variant="default" className="ml-2 bg-yellow-200 text-yellow-800">Pinned</Badge>}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 ${isPinned ? "text-yellow-600" : "text-slate-400"}`}
                      onClick={() => togglePin(origIndex)}
                    >
                      <Star className={`h-4 w-4 ${isPinned ? "fill-yellow-400" : ""}`} />
                    </Button>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    <p>{rec.description}</p>
                    <div className="mt-3 relative">
                      <pre className="bg-slate-800 text-slate-200 p-3 pr-12 rounded-md overflow-x-auto text-xs">
                        <code>{rec.example}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                        onClick={() => copyCode(rec.example)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
