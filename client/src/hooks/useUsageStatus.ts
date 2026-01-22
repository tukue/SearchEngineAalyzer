import { useState, useEffect, useCallback } from "react";

export interface UsageStatus {
  period: string;
  used: number;
  limit: number;
  warning_level: "none" | "warning_80" | "warning_90" | "exceeded";
}

export function useUsageStatus() {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(() => {
    fetch("/api/usage/current")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setUsage(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch usage:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchUsage();
    // Listen for analysis completion to refresh usage
    window.addEventListener("analysis-complete", fetchUsage);
    return () => window.removeEventListener("analysis-complete", fetchUsage);
  }, [fetchUsage]);

  return { usage, loading, refetch: fetchUsage };
}
