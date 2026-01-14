import { Monitor, CheckCircle, BarChart } from "lucide-react";

export default function GettingStarted() {
  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="text-center max-w-xl mx-auto">
        <Monitor className="h-16 w-16 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyze Your Website</h2>
        <p className="text-slate-600 mb-6">
          Enter a website URL to scan meta tags and receive prioritized recommendations for improvements.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Monitor className="h-6 w-6 text-primary" />
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-800">Comprehensive Analysis</h3>
            </div>
            <p className="text-sm text-slate-600">
              Get a complete breakdown of all meta tags on your website, organized by category.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-800">Validation</h3>
            </div>
            <p className="text-sm text-slate-600">
              Identify missing or improperly implemented meta tags that could be affecting your SEO.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <BarChart className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-800">Recommendations</h3>
            </div>
            <p className="text-sm text-slate-600">
              Get actionable recommendations to improve your meta tags and boost your site's visibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
