import { useState, useEffect } from "react";
import { MarketSignal, IdeaInsight } from "./types";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  Newspaper,
  RefreshCw,
  Book,
  Lightbulb,
  Save,
  Check,
  AlertCircle,
  TrendingUp,
  Users,
  Briefcase,
  DollarSign,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Props {
  ideaDetails: any;
  missionData: any;
  onInsightUpdate?: (insights: IdeaInsight[]) => void;
}

interface SavedEntry {
  source_url: string;
}

export function MarketSignalsSection({
  ideaDetails,
  missionData,
  onInsightUpdate,
}: Props) {
  const [signals, setSignals] = useState<{
    news: MarketSignal[];
    academic: MarketSignal[];
    patents: MarketSignal[];
    trends: MarketSignal[];
    competitors: MarketSignal[];
    industry: MarketSignal[];
    funding: MarketSignal[];
  }>({
    news: [],
    academic: [],
    patents: [],
    trends: [],
    competitors: [],
    industry: [],
    funding: [],
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSignals, setSavingSignals] = useState<{
    [key: string]: boolean;
  }>({});
  const [savedSignals, setSavedSignals] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [timeframeFilter, setTimeframeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  async function checkSavedSignals(signals: MarketSignal[]) {
    try {
      const { data: savedEntries } = await supabase
        .from("knowledge_base")
        .select("source_url")
        .eq("idea_id", ideaDetails.id);

      if (savedEntries) {
        const savedUrls = new Set(
          savedEntries.map((entry: SavedEntry) => entry.source_url)
        );
        const newSavedState: { [key: string]: boolean } = {};

        signals.forEach((signal) => {
          const signalKey = `${signal.type}-${signal.title}`;
          newSavedState[signalKey] = savedUrls.has(signal.url);
        });

        setSavedSignals(newSavedState);
      }
    } catch (error) {
      console.error("Error checking saved signals:", error);
    }
  }

  async function saveToKnowledgeBase(signal: MarketSignal) {
    const signalKey = `${signal.type}-${signal.title}`;
    try {
      setSavingSignals((prev) => ({ ...prev, [signalKey]: true }));

      // Get the current session for auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      const response = await fetch("/api/save-to-knowledge-base", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          signal,
          ideaId: ideaDetails.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          toast.error("This source is already in the knowledge base");
        } else {
          throw new Error(data.error || "Failed to save to knowledge base");
        }
        return;
      }

      setSavedSignals((prev) => ({ ...prev, [signalKey]: true }));
      toast.success("Added to knowledge base");

      if (onInsightUpdate && data.insights) {
        onInsightUpdate(data.insights);
      }
    } catch (error) {
      console.error("Error saving to knowledge base:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save to knowledge base"
      );
    } finally {
      setSavingSignals((prev) => ({ ...prev, [signalKey]: false }));
    }
  }

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
      setSignals(
        data.signals || {
          news: [],
          academic: [],
          patents: [],
          trends: [],
          competitors: [],
          industry: [],
          funding: [],
        }
      );

      const allSignals = Object.values(
        data.signals || {}
      ).flat() as MarketSignal[];
      await checkSavedSignals(allSignals);
    } catch (error) {
      console.error("Error fetching signals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (ideaDetails?.id) {
      const allSignals = Object.values(signals).flat() as MarketSignal[];
      checkSavedSignals(allSignals);
    }
  }, [ideaDetails?.id]);

  useEffect(() => {
    // Fetch market signals when the component mounts
    if (
      ideaDetails?.id &&
      !loading &&
      Object.values(signals).every((arr) => arr.length === 0)
    ) {
      setLoading(true);
      fetchSignals();
    }
  }, [ideaDetails?.id]);

  // Prevent showing both loading and refreshing spinners at the same time
  const isLoading = loading || refreshing;

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "academic":
        return <Book className="w-4 h-4 text-blue-400" />;
      case "patent":
        return <Lightbulb className="w-4 h-4 text-yellow-400" />;
      case "trend":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "competitor":
        return <Users className="w-4 h-4 text-red-400" />;
      case "industry":
        return <Briefcase className="w-4 h-4 text-purple-400" />;
      case "funding":
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      default:
        return <Newspaper className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;

    const classes =
      {
        positive: "bg-green-500/20 text-green-400 border-green-900",
        negative: "bg-red-500/20 text-red-400 border-red-900",
        neutral: "bg-blue-500/20 text-blue-400 border-blue-900",
      }[sentiment] || "bg-gray-500/20 text-gray-400 border-gray-900";

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${classes}`}>
        {sentiment}
      </span>
    );
  };

  const getTimeframeBadge = (timeframe?: string) => {
    if (!timeframe) return null;

    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        {timeframe}
      </span>
    );
  };

  // Filter signals based on current filters
  const filteredSignals = Object.fromEntries(
    Object.entries(signals).map(([category, items]) => {
      let filtered = items;

      if (timeframeFilter !== "all") {
        filtered = filtered.filter(
          (signal) => !signal.timeframe || signal.timeframe === timeframeFilter
        );
      }

      if (categoryFilter !== "all") {
        filtered = filtered.filter(
          (signal) => !signal.category || signal.category === categoryFilter
        );
      }

      return [category, filtered];
    })
  );

  // Get all available categories and timeframes for filters
  const availableCategories = new Set<string>();
  const availableTimeframes = new Set<string>();

  Object.values(signals)
    .flat()
    .forEach((signal) => {
      if (signal.category) availableCategories.add(signal.category);
      if (signal.timeframe) availableTimeframes.add(signal.timeframe);
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-gray-400" />
          <h3 className="text-lg font-semibold">Market Signals</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1 transition-colors flex items-center gap-2 text-sm"
          >
            <Filter className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={fetchSignals}
            disabled={isLoading}
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
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="p-4 bg-accent-1/30 border border-accent-2 rounded-lg mb-4">
          <h4 className="font-medium mb-3">Filter Market Signals</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Timeframe
              </label>
              <select
                value={timeframeFilter}
                onChange={(e) => setTimeframeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-accent-2 rounded-lg text-white"
              >
                <option value="all">All Timeframes</option>
                {Array.from(availableTimeframes).map((timeframe) => (
                  <option key={timeframe} value={timeframe}>
                    {timeframe}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-accent-2 rounded-lg text-white"
              >
                <option value="all">All Categories</option>
                {Array.from(availableCategories).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : Object.entries(filteredSignals).some(
          ([_, items]) => items.length > 0
        ) ? (
        <div className="space-y-6">
          {Object.entries(filteredSignals).map(
            ([category, items]) =>
              items.length > 0 && (
                <div key={category} className="space-y-4">
                  <h4 className="text-sm font-medium capitalize text-gray-400">
                    {category}
                  </h4>
                  {items.map((signal, index) => {
                    const signalKey = `${signal.type}-${signal.title}`;
                    const isSaving = savingSignals[signalKey];
                    const isSaved = savedSignals[signalKey];

                    return (
                      <div
                        key={index}
                        className="block p-4 bg-accent-1/30 border border-accent-2 rounded-lg hover:bg-accent-1/50 transition-colors"
                      >
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getSignalIcon(signal.type)}
                              <h4 className="font-medium">{signal.title}</h4>
                              {signal.impactLevel === "high" && (
                                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-900 rounded-full text-xs">
                                  High Impact
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 mb-2">
                              {signal.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {getSentimentBadge(signal.sentiment)}
                              {getTimeframeBadge(signal.timeframe)}
                              {signal.trendDirection && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <TrendingUp className="w-3 h-3" />
                                  {signal.trendDirection}
                                </span>
                              )}
                              {signal.category && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-1/50 border border-accent-2">
                                  {signal.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
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
                              <div className="flex items-center gap-4">
                                <a
                                  href={signal.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                  View Source
                                </a>
                                <button
                                  onClick={() => saveToKnowledgeBase(signal)}
                                  disabled={isSaving || isSaved}
                                  className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                                    isSaved
                                      ? "bg-green-500/20 text-green-400 border-green-900"
                                      : "bg-accent-1/50 hover:bg-accent-1 border-accent-2"
                                  } disabled:opacity-50`}
                                >
                                  {isSaving ? (
                                    <>
                                      <LoadingSpinner className="w-3 h-3" />
                                      Saving...
                                    </>
                                  ) : isSaved ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Saved
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-3 h-3" />
                                      Save to Knowledge Base
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
