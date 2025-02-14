import { useState } from "react";
import { MarketSignal } from "./types";
import { LoadingSpinner } from "./LoadingSpinner";
import { Newspaper, RefreshCw, Book, Lightbulb } from "lucide-react";

interface Props {
  ideaDetails: any;
  missionData: any;
}

export function NewsSection({ ideaDetails, missionData }: Props) {
  const [signals, setSignals] = useState<{
    news: MarketSignal[];
    academic: MarketSignal[];
    patents: MarketSignal[];
  }>({ news: [], academic: [], patents: [] });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchSignals() {
    try {
      setRefreshing(true);
      const response = await fetch("/api/fetch-market-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaName: ideaDetails.name,
          category: ideaDetails.category,
          signals: ideaDetails.signals,
          missionName: missionData?.name,
          organizationName: missionData?.organization?.name,
          aiAnalysis: ideaDetails.ai_analysis,
        }),
      });

      const data = await response.json();
      setSignals(data.signals || { news: [], academic: [], patents: [] });
    } catch (error) {
      console.error("Error fetching signals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "academic":
        return <Book className="w-4 h-4 text-blue-400" />;
      case "patent":
        return <Lightbulb className="w-4 h-4 text-yellow-400" />;
      default:
        return <Newspaper className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-gray-400" />
          <h3 className="text-lg font-semibold">Market Signals</h3>
        </div>
        <button
          onClick={fetchSignals}
          disabled={refreshing}
          className="px-3 py-1.5 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1 transition-colors flex items-center gap-2 text-sm"
        >
          {refreshing ? (
            <>
              <LoadingSpinner className="w-3 h-3" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              Refresh
            </>
          )}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : Object.entries(signals).some(([_, items]) => items.length > 0) ? (
        <div className="space-y-6">
          {Object.entries(signals).map(
            ([category, items]) =>
              items.length > 0 && (
                <div key={category} className="space-y-4">
                  <h4 className="text-sm font-medium capitalize text-gray-400">
                    {category}
                  </h4>
                  {items.map((signal, index) => (
                    <a
                      key={index}
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-accent-1/30 border border-accent-2 rounded-lg hover:bg-accent-1/50 transition-colors"
                    >
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getSignalIcon(signal.type)}
                            <h4 className="font-medium">{signal.title}</h4>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">
                            {signal.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{signal.source}</span>
                            <span>•</span>
                            <span>
                              {signal.date !== "N/A"
                                ? new Date(signal.date).toLocaleDateString(
                                    undefined,
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    }
                                  )
                                : "Date not available"}
                            </span>
                            {signal.type === "patent" &&
                              signal.patentNumber && (
                                <>
                                  <span>•</span>
                                  <span>Patent #{signal.patentNumber}</span>
                                  {signal.status && (
                                    <>
                                      <span>•</span>
                                      <span>{signal.status}</span>
                                    </>
                                  )}
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )
          )}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">
          No market signals found
        </div>
      )}
    </div>
  );
}
