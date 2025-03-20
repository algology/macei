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
  const [activeTab, setActiveTab] = useState<string>("all");

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

      // Filter out any signals with invalid URLs
      const apiSignals = data.signals || {
        news: [],
        academic: [],
        patents: [],
        trends: [],
        competitors: [],
        industry: [],
        funding: [],
      };

      const processedSignals = {
        news: (apiSignals.news || []).filter((signal: MarketSignal) =>
          isValidUrl(signal.url)
        ),
        academic: (apiSignals.academic || []).filter((signal: MarketSignal) =>
          isValidUrl(signal.url)
        ),
        patents: (apiSignals.patents || []).filter((signal: MarketSignal) =>
          isValidUrl(signal.url)
        ),
        trends: (apiSignals.trends || []).filter((signal: MarketSignal) =>
          isValidUrl(signal.url)
        ),
        competitors: (apiSignals.competitors || []).filter(
          (signal: MarketSignal) => isValidUrl(signal.url)
        ),
        industry: (apiSignals.industry || []).filter((signal: MarketSignal) =>
          isValidUrl(signal.url)
        ),
        funding: (apiSignals.funding || []).filter((signal: MarketSignal) =>
          isValidUrl(signal.url)
        ),
      };

      setSignals(processedSignals);

      const allSignals = Object.values(
        processedSignals
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

  // No longer fetch signals automatically when component mounts
  // Instead, show an initial state that requires user interaction

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

    const labels = {
      positive: "Positive Impact",
      negative: "Negative Impact",
      neutral: "Neutral Impact",
    };

    const icons = {
      positive: <TrendingUp className="w-3 h-3" />,
      negative: <AlertCircle className="w-3 h-3" />,
      neutral: <Newspaper className="w-3 h-3" />,
    };

    const classes =
      {
        positive: "bg-green-500/20 text-green-400 border-green-900",
        negative: "bg-red-500/20 text-red-400 border-red-900",
        neutral: "bg-blue-500/20 text-blue-400 border-blue-900",
      }[sentiment] || "bg-gray-500/20 text-gray-400 border-gray-900";

    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full border ${classes} flex items-center gap-1`}
      >
        {icons[sentiment as keyof typeof icons]}
        {labels[sentiment as keyof typeof labels] || sentiment}
      </span>
    );
  };

  const getCategoryBadge = (category?: string, type?: string) => {
    if (!category && !type) return null;

    const displayCategory = category || type;

    const bgColors = {
      news: "bg-gray-500/20 text-gray-300 border-gray-800",
      academic: "bg-blue-500/20 text-blue-300 border-blue-900",
      patent: "bg-yellow-500/20 text-yellow-300 border-yellow-900",
      trend: "bg-green-500/20 text-green-300 border-green-900",
      competitor: "bg-red-500/20 text-red-300 border-red-900",
      industry: "bg-purple-500/20 text-purple-300 border-purple-900",
      funding: "bg-emerald-500/20 text-emerald-300 border-emerald-900",
    };

    const bgClass =
      bgColors[type as keyof typeof bgColors] ||
      "bg-accent-1/50 border-accent-2 text-gray-300";

    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full border ${bgClass} flex items-center gap-1`}
      >
        {getSignalIcon(type || "")}
        {displayCategory}
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

  // Tab definitions with pretty names and icons
  const tabs = [
    {
      id: "all",
      label: "All Signals",
      icon: <Newspaper className="w-4 h-4" />,
    },
    { id: "news", label: "News", icon: <Newspaper className="w-4 h-4" /> },
    { id: "trend", label: "Trends", icon: <TrendingUp className="w-4 h-4" /> },
    {
      id: "competitor",
      label: "Competitors",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "industry",
      label: "Industry",
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: "funding",
      label: "Funding",
      icon: <DollarSign className="w-4 h-4" />,
    },
    { id: "academic", label: "Academic", icon: <Book className="w-4 h-4" /> },
    { id: "patent", label: "Patents", icon: <Lightbulb className="w-4 h-4" /> },
  ];

  // Type guard to check if a category exists in our signals object
  const isValidCategory = (
    category: string
  ): category is keyof typeof signals => {
    return category in signals;
  };

  // Filter signals based only on active tab
  const filteredSignals = Object.fromEntries(
    Object.entries(signals).map(([category, items]) => {
      // Filter by active tab
      if (activeTab !== "all") {
        // If the active tab is one of the signal types, only show those items
        if (category === activeTab) {
          return [category, items];
        }
        // If the active tab is a signal type, but not this category, return empty
        else if (tabs.some((tab) => tab.id === activeTab)) {
          return [category, []];
        }
      }

      return [category, items];
    })
  );

  const isValidUrl = (url: string) => {
    try {
      // Check if the URL is properly formed by parsing it
      const parsedUrl = new URL(url);

      // Check for common signs of synthetic/hallucinated URLs
      const isSuspiciousUrl =
        !url ||
        url === "" ||
        url.includes("...") ||
        url.includes("example.com") ||
        url.includes("/invalid-url") ||
        url === "#" ||
        url.endsWith("/") ||
        url.includes("examplereport") ||
        url.includes("hypothetical");

      return (
        !isSuspiciousUrl &&
        (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:")
      );
    } catch (e) {
      return false;
    }
  };

  // Only show source name without any AI label
  const getSourceTag = (signal: MarketSignal) => {
    return <span>{signal.source}</span>;
  };

  // When changing tabs, we don't need to reset filters anymore
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-gray-400" />
          <h3 className="text-lg font-semibold">Market Signals</h3>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Category Tabs */}
      <div className="border-b border-accent-2 mb-4 -mx-1">
        <div className="flex overflow-x-auto space-x-1 pb-1">
          {tabs.map((tab) => {
            // Only show tabs that have content
            const hasContent =
              tab.id === "all" ||
              (isValidCategory(tab.id) && signals[tab.id].length > 0);

            if (!hasContent) return null;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-2 flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-500 text-blue-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id !== "all" && isValidCategory(tab.id) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-accent-1/50 text-xs rounded-full">
                    {signals[tab.id].length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-10 border border-accent-2 rounded-lg bg-accent-1/30">
          <div className="flex flex-col items-center space-y-4">
            <LoadingSpinner className="w-8 h-8 text-blue-400" />
            <div className="text-center space-y-1">
              <p className="text-gray-300 font-medium">
                Refreshing Market Signals
              </p>
              <p className="text-sm text-gray-500">
                This may take a moment as we search for the latest data
              </p>
            </div>
          </div>
        </div>
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
                              {getCategoryBadge(signal.category, signal.type)}
                              {getSentimentBadge(signal.sentiment)}
                              {getTimeframeBadge(signal.timeframe)}
                              {signal.trendDirection && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <TrendingUp className="w-3 h-3" />
                                  {signal.trendDirection}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {getSourceTag(signal)}
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
                                {isValidUrl(signal.url) ? (
                                  <a
                                    href={signal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    View Source
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    No source available
                                  </span>
                                )}
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
        <div className="text-center py-8 border border-accent-2 rounded-lg bg-accent-1/30">
          <div className="text-gray-400 mb-2">
            {activeTab !== "all"
              ? "No signals found for this category"
              : "Click refresh to load market signals"}
          </div>
          {activeTab !== "all" && (
            <div className="text-sm text-gray-500">
              Try selecting "All Signals" from the tabs above
              <div className="mt-2">
                <button
                  onClick={() => setActiveTab("all")}
                  className="px-3 py-1.5 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1 transition-colors text-sm inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Show All Signals
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
