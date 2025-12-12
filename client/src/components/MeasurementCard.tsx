import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";

interface MeasurementCardProps {
  title: string;
  score: number;
  description: string;
  details?: string;
  recommendations?: string[];
  icon?: React.ReactNode;
}

export default function MeasurementCard({ 
  title, 
  score, 
  description, 
  details, 
  recommendations = [],
  icon 
}: MeasurementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 80) return "bg-green-400";
    if (score >= 70) return "bg-yellow-500";
    if (score >= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 70) return "Average";
    if (score >= 50) return "Needs Work";
    return "Poor";
  };

  const getBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 70) return "secondary";
    if (score >= 50) return "outline";
    return "destructive";
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant={getBadgeVariant(score) as any}>
            {getScoreLabel(score)}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{score}</span>
            </div>
            <div 
              className={`absolute inset-0 rounded-full ${getScoreColor(score)} opacity-20`}
            />
          </div>
          <div className="flex-1">
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getScoreColor(score)}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 mt-1">{score}/100</p>
          </div>
        </div>

        {/* Expandable Details */}
        {(details || recommendations.length > 0) && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between p-2 h-auto"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                View Details
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {isExpanded && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                {details && (
                  <div>
                    <h4 className="font-medium text-sm text-slate-700 mb-1">Details</h4>
                    <p className="text-sm text-slate-600">{details}</p>
                  </div>
                )}
                
                {recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-slate-700 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}