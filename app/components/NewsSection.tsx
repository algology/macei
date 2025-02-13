import { useState } from "react";
import { NewsArticle } from "./types";
import { LoadingSpinner } from "./LoadingSpinner";
import { Newspaper, RefreshCw } from "lucide-react";

interface Props {
  ideaDetails: any;
  missionData: any;
}

export function NewsSection({ ideaDetails, missionData }: Props) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchNews() {
    try {
      setRefreshing(true);
      const response = await fetch("/api/fetch-news", {
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
      setNews(data.articles || []);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-gray-400" />
          <h3 className="text-lg font-semibold">Relevant Market Signals</h3>
        </div>
        <button
          onClick={fetchNews}
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
      ) : news.length > 0 ? (
        <div className="space-y-4">
          {news.map((article, index) => (
            <a
              key={index}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-accent-1/30 border border-accent-2 rounded-lg hover:bg-accent-1/50 transition-colors"
            >
              <div className="flex gap-4">
                {article.urlToImage && (
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    className="w-24 h-24 object-cover rounded-md"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-medium mb-2">{article.title}</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    {article.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{article.source.name}</span>
                    <span>•</span>
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">
          No relevant market signals found
        </div>
      )}
    </div>
  );
}
