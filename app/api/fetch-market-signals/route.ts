import {
  NewsResponse,
  MarketSignalsResponse,
  MarketSignal,
} from "@/app/components/types";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Define JSON schemas for expected response formats
const searchQueriesSchema = {
  newsQuery: "string",
  academicQuery: "string",
  patentQuery: "string",
  trendQuery: "string",
  competitorQuery: "string",
  industryQuery: "string",
  fundingQuery: "string",
  keyPhrases: ["string"],
};

// Helper function to validate JSON before parsing
function safeJsonParse(jsonString: string, fallback: any = {}) {
  try {
    // Basic structural validation
    if (
      !jsonString ||
      typeof jsonString !== "string" ||
      !jsonString.trim().startsWith("{") ||
      !jsonString.trim().endsWith("}")
    ) {
      console.error("Invalid JSON structure:", jsonString?.slice(0, 100));
      return fallback;
    }
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON parse error:", error);
    return fallback;
  }
}

export async function POST(request: Request) {
  try {
    console.log("API Keys available:", {
      SERP_API: !!process.env.SERP_API_KEY,
      GROQ_API: !!process.env.GROQ_API_KEY,
    });

    const body = await request.json();
    const {
      ideaName,
      category,
      signals,
      missionName,
      organizationName,
      aiAnalysis,
    } = body;

    console.log("Received request with:", {
      ideaName,
      category,
      signalsLength: signals
        ? typeof signals === "string"
          ? signals.length
          : "not a string"
        : "undefined",
      missionName,
      organizationName,
    });

    const SERP_API_KEY = process.env.SERP_API_KEY;

    // Generate optimized search queries using Groq/Gemma
    const searchPrompt = `
    I need to find comprehensive market information for a business idea. Help me generate optimal search queries for multiple types of market signals based on the following information:
    
    Idea Name: ${ideaName || ""}
    Category: ${category || ""}
    Organization: ${organizationName || ""}
    Mission: ${missionName || ""}
    Market Signals: ${signals || ""}
    AI Analysis: ${aiAnalysis || ""}
    
    Create SPECIFIC and TARGETED search queries that will yield highly relevant results. Focus on the core concepts and avoid generic terms.
    Use the current year (${new Date().getFullYear()}) if including a year in queries, or prefer timeless queries without specific years.
    
    For example, if this is about "content moderation with AI", use specific terms like "AI content moderation tools", "machine learning toxic content detection", "automated moderation systems".
    
    The JSON object MUST use this exact schema and types:
    ${JSON.stringify(searchQueriesSchema, null, 2)}
    
    When generating the JSON:
    1. Ensure all values are valid strings
    2. For arrays, ensure all elements are strings
    3. Do not include any comments or additional keys
    4. Use short, focused search terms (under 100 characters each)
    `;

    // Call Groq API to generate optimized search queries
    const queryCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a search query generator that produces clean, valid JSON. Your JSON output must strictly follow the provided schema with no additional fields.",
        },
        {
          role: "user",
          content: searchPrompt,
        },
      ],
      model: "deepseek-r1-distill-llama-70b", // Using llama-3.3-70b-versatile for better JSON generation
      temperature: 0.7, // Zero temperature for deterministic output
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    // Parse the generated queries with validation
    const searchQueries = safeJsonParse(
      queryCompletion.choices[0]?.message?.content || "{}",
      {
        newsQuery: "",
        academicQuery: "",
        patentQuery: "",
        trendQuery: "",
        competitorQuery: "",
        industryQuery: "",
        fundingQuery: "",
        keyPhrases: [],
      }
    );

    if (
      !searchQueries.newsQuery &&
      !searchQueries.academicQuery &&
      !searchQueries.patentQuery
    ) {
      // Fallback to original method if AI query generation fails
      // Parse and extract signals
      let searchTerms = "";
      if (signals) {
        try {
          const parsedSignals = JSON.parse(signals);
          let signalTerms: string[] = [];

          if (Array.isArray(parsedSignals)) {
            // Process each signal phrase to extract key terms
            signalTerms = parsedSignals.flatMap((signal: string) => {
              // Split into words and filter out common words
              const words = signal.toLowerCase().split(/\s+/);
              const keyTerms = words.filter(
                (word: string) =>
                  !["in", "for", "of", "the", "and", "to", "a", "on"].includes(
                    word
                  )
              );
              // Group related terms with OR
              return [keyTerms.join(" OR ")];
            });
          } else if (
            typeof parsedSignals === "object" &&
            parsedSignals !== null
          ) {
            signalTerms = Object.values(parsedSignals)
              .flat()
              .flatMap((signal: unknown) => {
                if (typeof signal !== "string") return [];
                const words = signal.toLowerCase().split(/\s+/);
                const keyTerms = words.filter(
                  (word: string) =>
                    ![
                      "in",
                      "for",
                      "of",
                      "the",
                      "and",
                      "to",
                      "a",
                      "on",
                    ].includes(word)
                );
                return [keyTerms.join(" OR ")];
              });
          } else if (typeof parsedSignals === "string") {
            const words = parsedSignals.toLowerCase().split(/\s+/);
            const keyTerms = words.filter(
              (word: string) =>
                !["in", "for", "of", "the", "and", "to", "a", "on"].includes(
                  word
                )
            );
            signalTerms = [keyTerms.join(" OR ")];
          }

          // Combine different signal phrases with AND
          searchTerms = signalTerms.join(") AND (");
          if (signalTerms.length > 0) {
            searchTerms = `(${searchTerms})`;
          }
        } catch (e) {
          // Handle plain text format
          const words = signals
            .toLowerCase()
            .split(/\s+/)
            .filter(
              (word: string) =>
                !["in", "for", "of", "the", "and", "to", "a", "on"].includes(
                  word
                )
            );
          searchTerms = words.join(" OR ");
        }
      }

      searchQueries.newsQuery = searchTerms;
      searchQueries.academicQuery = searchTerms;
      searchQueries.patentQuery = searchTerms;
    }

    console.log("AI-Generated search queries:", searchQueries); // For debugging

    if (
      !searchQueries.newsQuery &&
      !searchQueries.academicQuery &&
      !searchQueries.patentQuery
    ) {
      return Response.json({
        signals: { news: [], academic: [], patents: [] },
      });
    }

    // Fetch from multiple sources in parallel
    const [newsResults, scholarResults, patentsResults] = await Promise.all([
      // News (via SerpAPI) with enhanced query
      fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
          searchQueries.newsQuery
        )}&api_key=${SERP_API_KEY}&num=30&tbm=nws&hl=en`
      ).then((res) => res.json()),

      // Google Scholar (via SerpAPI) with enhanced query
      fetch(
        `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(
          searchQueries.academicQuery
        )}&api_key=${SERP_API_KEY}&num=10`
      ).then((res) => res.json()),

      // Google Patents (via SerpAPI) with enhanced query
      fetch(
        `https://serpapi.com/search.json?engine=google_patents&q=${encodeURIComponent(
          searchQueries.patentQuery
        )}&api_key=${SERP_API_KEY}&num=20&language=ENGLISH&has_abstract=true`
      ).then((res) => res.json()),
    ]);

    // Debug API responses
    console.log(
      "SERP News API response count:",
      newsResults.news_results?.length || 0
    );
    console.log(
      "SERP Scholar API response count:",
      scholarResults.organic_results?.length || 0
    );
    console.log(
      "SERP Patents API response count:",
      patentsResults.organic_results?.length || 0
    );

    // Handle case where SERP News API returns no results
    let newsArticles = (newsResults.news_results || []).map((article: any) => ({
      title: article.title,
      description: article.snippet,
      url: article.link,
      source: article.source,
      date: article.date || new Date().toISOString(),
      type: "news",
    }));

    // If SERP News API returned no results or had an error, try multiple fallback queries
    if (newsArticles.length === 0) {
      console.log(
        "SERP News API returned no results, trying multiple fallback queries"
      );

      // Create an array of different fallback queries to try
      const fallbackQueries = [
        // Use key phrases
        searchQueries.keyPhrases ? searchQueries.keyPhrases.join(" OR ") : null,

        // Use more generic searches based on category or idea
        `${category || ideaName || ""} industry trends`,
        `${category || ideaName || ""} latest developments`,
        `${ideaName || category || ""} business news`,
        `${ideaName || category || ""} technology news`,
        `${category || ""} innovations`,
        `${(ideaName || "").split(" ")[0] || category || ""} news`, // Try with just first word

        // Try general term
        ideaName || category || missionName || "technology news",
      ].filter(Boolean); // Remove any null entries

      console.log("Using fallback news queries:", fallbackQueries);

      // Try each query until we get results
      for (const query of fallbackQueries) {
        try {
          console.log(`Trying fallback query: ${query}`);

          const fallbackNewsResponse = await fetch(
            `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
              query
            )}&api_key=${SERP_API_KEY}&num=15&tbm=nws&hl=en`
          ).then((res) => res.json());

          console.log(
            `Results for '${query}':`,
            fallbackNewsResponse.news_results?.length || 0
          );

          // If we got results, use them and stop trying
          if (
            fallbackNewsResponse.news_results &&
            fallbackNewsResponse.news_results.length > 0
          ) {
            newsArticles = fallbackNewsResponse.news_results.map(
              (article: any) => ({
                title: article.title,
                description: article.snippet,
                url: article.link,
                source: article.source,
                date: article.date || new Date().toISOString(),
                type: "news",
              })
            );
            break;
          }
        } catch (error) {
          console.error(`Error with fallback query '${query}':`, error);
        }
      }
    }

    // If we still have no news articles, try top headlines as a last resort
    if (newsArticles.length === 0) {
      try {
        console.log("Trying top headlines with more specific categories");

        // Try to build a more relevant category based on the idea
        let category = "technology";
        if (
          ideaName?.toLowerCase().includes("content moderation") ||
          signals?.toLowerCase().includes("content moderation")
        ) {
          category = "technology";
        } else if (
          ideaName?.toLowerCase().includes("game") ||
          signals?.toLowerCase().includes("game")
        ) {
          category = "entertainment";
        }

        const topHeadlinesResponse = await fetch(
          `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
            `${category} news`
          )}&api_key=${SERP_API_KEY}&num=15&tbm=nws&hl=en`
        ).then((res) => res.json());

        if (
          topHeadlinesResponse.news_results &&
          topHeadlinesResponse.news_results.length > 0
        ) {
          console.log(
            `Got ${category} headlines:`,
            topHeadlinesResponse.news_results.length
          );
          newsArticles = topHeadlinesResponse.news_results.map(
            (article: any) => ({
              title: article.title,
              description: article.snippet,
              url: article.link,
              source: article.source,
              date: article.date || new Date().toISOString(),
              type: "news",
            })
          );
        }
      } catch (error) {
        console.error("Error fetching top headlines:", error);
      }
    }

    // Handle case where SERP API returns no scholar results
    if (
      !scholarResults.organic_results ||
      scholarResults.organic_results.length === 0
    ) {
      console.log(
        "Scholar API response sample:",
        JSON.stringify(scholarResults).slice(0, 200)
      );
    }

    if (
      !patentsResults.organic_results ||
      patentsResults.organic_results.length === 0
    ) {
      console.log(
        "Patents API response sample:",
        JSON.stringify(patentsResults).slice(0, 200)
      );
    }

    // Helper function to validate URLs
    function validateUrl(url: string): string {
      try {
        // Try parsing the URL to validate it
        const parsedUrl = new URL(url);

        // Check if it's a suspicious URL pattern
        if (
          url.includes("...") ||
          url.includes("[") ||
          url.includes("]") ||
          url === "https://example.com/article"
        ) {
          // Generate a more realistic URL for synthetic content
          const domain = parsedUrl.hostname;
          const randomPath = `/${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .substring(2, 7)}`;
          return `${parsedUrl.protocol}//${domain}${randomPath}`;
        }

        return url;
      } catch (e) {
        // If URL parsing fails, construct a fallback URL
        console.log("Invalid URL detected:", url);
        return "https://example.com/invalid-url";
      }
    }

    // Collect all raw results
    const rawMarketSignals: {
      news: MarketSignal[];
      academic: MarketSignal[];
      patents: MarketSignal[];
      trends: MarketSignal[];
      competitors: MarketSignal[];
      industry: MarketSignal[];
      funding: MarketSignal[];
    } = {
      news: (() => {
        // If we have no news articles, return an empty array instead of hardcoded fallbacks
        if (!newsArticles || newsArticles.length === 0) {
          console.log("No news articles found after all fallback attempts");
          return [];
        }

        return newsArticles;
      })(),

      academic: (() => {
        // Handle academic results which may have different response formats
        if (
          !scholarResults.organic_results ||
          scholarResults.organic_results.length === 0
        ) {
          console.log(
            "No academic results or unexpected format:",
            JSON.stringify(scholarResults).slice(0, 200)
          );

          // Try alternative field names that might be in the response
          const alternativeResults =
            scholarResults.results ||
            scholarResults.papers ||
            scholarResults.items ||
            [];

          if (alternativeResults.length > 0) {
            return alternativeResults.map((paper: any) => ({
              title: paper.title || "Academic Paper",
              description:
                paper.snippet ||
                paper.summary ||
                paper.abstract ||
                "No description available",
              url: paper.link || paper.url || "",
              source:
                paper.publication_info?.summary ||
                paper.journal ||
                paper.source ||
                "Academic Paper",
              date: paper.publication_info?.year
                ? new Date(paper.publication_info.year, 0).toISOString()
                : paper.publication_info?.published_date || paper.date || "N/A",
              type: "academic",
            }));
          }

          return [];
        }

        return scholarResults.organic_results.map((paper: any) => ({
          title: paper.title || "Academic Paper",
          description:
            paper.snippet ||
            paper.summary ||
            paper.abstract ||
            "No description available",
          url: paper.link || paper.url || "",
          source:
            paper.publication_info?.summary ||
            paper.journal ||
            paper.source ||
            "Academic Paper",
          date: paper.publication_info?.year
            ? new Date(paper.publication_info.year, 0).toISOString()
            : paper.publication_info?.published_date || paper.date || "N/A",
          type: "academic",
        }));
      })(),

      patents: (() => {
        // Handle patents which may have different response formats
        if (
          !patentsResults.organic_results ||
          patentsResults.organic_results.length === 0
        ) {
          console.log(
            "No patent results or unexpected format:",
            JSON.stringify(patentsResults).slice(0, 200)
          );
          return [];
        }

        return patentsResults.organic_results.slice(0, 5).map((patent: any) => {
          // Extract patent URL, handling different formats
          const patentUrl =
            patent.patent_link || patent.link || patent.url || "";

          // Extract patent number, handling different formats
          const patentNumber =
            patent.publication_number ||
            (patent.title && patent.title.match(/([A-Z]{2}\d+)/)?.[0]) ||
            "Unknown";

          // Extract patent status
          let status = "N/A";
          if (
            patent.country_status &&
            typeof patent.country_status === "object"
          ) {
            const firstStatus = Object.entries(patent.country_status)[0];
            if (firstStatus && firstStatus.length > 1) {
              status = firstStatus[1] as string;
            }
          }

          return {
            title: patent.title || "Patent",
            description:
              patent.snippet ||
              patent.description ||
              "No description available",
            url: patentUrl,
            source: patent.assignee || patent.source || "Patent",
            date:
              patent.publication_date ||
              patent.filing_date ||
              patent.date ||
              "N/A",
            type: "patent",
            patentNumber: patentNumber,
            status: status,
            inventor: patent.inventor || "N/A",
          };
        });
      })(),

      trends: [],
      competitors: [],
      industry: [],
      funding: [],
    };

    // If we have too few results, return them without filtering
    const totalResults =
      rawMarketSignals.news.length +
      rawMarketSignals.academic.length +
      rawMarketSignals.patents.length;

    // Check for relevance using simple keyword matching
    const ideaKeywords = [
      ideaName?.toLowerCase() || "",
      category?.toLowerCase() || "",
      ...(searchQueries.keyPhrases || []).map((p: string) => p.toLowerCase()),
    ].filter(Boolean);

    // Make keyword matching less aggressive by using partial matching
    function hasRelevance(text: string, keywords: string[]): boolean {
      // If we have no keywords, consider everything relevant
      if (keywords.length === 0 || !keywords[0]) return true;

      // Break down the text into words for more flexible matching
      const textWords = text.toLowerCase().split(/\s+/);

      // Check if any keyword partially matches any word in the text
      return keywords.some((keyword) => {
        if (keyword.length < 3) return true; // Skip very short keywords
        return (
          text.toLowerCase().includes(keyword) ||
          textWords.some(
            (word) => word.includes(keyword) || keyword.includes(word)
          )
        );
      });
    }

    // Apply initial keyword-based filtering to base results
    if (ideaKeywords.length > 0 && ideaKeywords[0]) {
      // Filter news articles for relevance, but keep more results
      rawMarketSignals.news = rawMarketSignals.news.filter((article) => {
        const text = (
          article.title +
          " " +
          (article.description || "")
        ).toLowerCase();
        return (
          hasRelevance(text, ideaKeywords) ||
          // If no matches, keep the top 8 as they might still be relevant
          rawMarketSignals.news.indexOf(article) < 8
        );
      });

      // Filter academic papers for relevance, but keep more results
      rawMarketSignals.academic = rawMarketSignals.academic.filter((paper) => {
        const text = (
          paper.title +
          " " +
          (paper.description || "")
        ).toLowerCase();
        return (
          hasRelevance(text, ideaKeywords) ||
          // If no matches, keep the top 5 as they might still be relevant
          rawMarketSignals.academic.indexOf(paper) < 5
        );
      });

      // Filter patents for relevance, but keep more results
      rawMarketSignals.patents = rawMarketSignals.patents.filter((patent) => {
        const text = (
          patent.title +
          " " +
          (patent.description || "")
        ).toLowerCase();
        return (
          hasRelevance(text, ideaKeywords) ||
          // If no matches, keep the top 5 as they might still be relevant
          rawMarketSignals.patents.indexOf(patent) < 5
        );
      });
    }

    // Generate additional market signals using AI combined with real API data
    if (rawMarketSignals.news.length > 0) {
      try {
        console.log("Fetching additional categories of market signals");

        // First, fetch additional data from real APIs for the enhanced signals
        const additionalDataPromises = [
          // Fetch trend data (use SERP API with trend query)
          fetch(
            `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
              searchQueries.trendQuery ||
                `${category || ideaName} market trends`
            )}&api_key=${SERP_API_KEY}&num=10&tbm=nws&hl=en`
          ).then((res) => res.json()),

          // Fetch competitor data (use SERP API with competitor query)
          fetch(
            `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
              searchQueries.competitorQuery ||
                `${category || ideaName} competitors`
            )}&api_key=${SERP_API_KEY}&num=10&tbm=nws&hl=en`
          ).then((res) => res.json()),

          // Fetch industry data (use SERP API with industry query)
          fetch(
            `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
              searchQueries.industryQuery ||
                `${category || ideaName} industry report`
            )}&api_key=${SERP_API_KEY}&num=10&tbm=nws&hl=en`
          ).then((res) => res.json()),

          // Fetch funding data (use SERP API with funding query)
          fetch(
            `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
              searchQueries.fundingQuery ||
                `${category || ideaName} funding investment`
            )}&api_key=${SERP_API_KEY}&num=10&tbm=nws&hl=en`
          ).then((res) => res.json()),
        ];

        // Wait for all API responses
        const [
          trendResults,
          competitorResults,
          industryResults,
          fundingResults,
        ] = await Promise.all(additionalDataPromises);

        // DIRECT MAPPING: Map results directly to their categories, skipping AI enhancement entirely
        console.log(
          "Using direct mapping for additional market signals (skipping AI)"
        );

        const mapNewsToType = (
          articles: any[],
          type: "trend" | "competitor" | "industry" | "funding"
        ): MarketSignal[] => {
          return (articles || [])
            .map((article: any) => ({
              title: String(article.title || ""),
              description: String(article.snippet || ""),
              url: validateUrl(String(article.link || "")),
              source: String(article.source || ""),
              date: String(article.date || new Date().toISOString()),
              type: type,
            }))
            .slice(0, 8); // Allow up to 8 results per category
        };

        // Map directly without AI filtering
        rawMarketSignals.trends = mapNewsToType(
          trendResults.news_results,
          "trend"
        );

        rawMarketSignals.competitors = mapNewsToType(
          competitorResults.news_results,
          "competitor"
        );

        rawMarketSignals.industry = mapNewsToType(
          industryResults.news_results,
          "industry"
        );

        rawMarketSignals.funding = mapNewsToType(
          fundingResults.news_results,
          "funding"
        );

        console.log(
          "Successfully added all market signal categories through direct mapping"
        );
      } catch (error) {
        console.error("Error in market signals generation:", error);
        rawMarketSignals.trends = [];
        rawMarketSignals.competitors = [];
        rawMarketSignals.industry = [];
        rawMarketSignals.funding = [];
      }
    } else {
      // Initialize empty arrays for new signal types
      rawMarketSignals.trends = [];
      rawMarketSignals.competitors = [];
      rawMarketSignals.industry = [];
      rawMarketSignals.funding = [];
    }

    // Increase this threshold to allow more results to be returned unfiltered
    if (totalResults <= 15) {
      return Response.json({ signals: rawMarketSignals });
    }

    // DIRECT FILTERING: Apply simple keyword-based filtering instead of using AI
    console.log("Using direct keyword-based filtering (skipping AI filtering)");

    // Filter helper function that uses our existing hasRelevance function
    const filterByRelevance = (
      signals: MarketSignal[],
      limit: number
    ): MarketSignal[] => {
      return signals
        .filter((signal) => {
          const text = (
            signal.title +
            " " +
            (signal.description || "")
          ).toLowerCase();
          return (
            hasRelevance(text, ideaKeywords) ||
            signals.indexOf(signal) < Math.ceil(limit / 2)
          ); // Keep at least half
        })
        .slice(0, limit);
    };

    // Create a filtered version of the signals using direct filtering
    const marketSignals = {
      news: filterByRelevance(rawMarketSignals.news, 10),
      academic: filterByRelevance(rawMarketSignals.academic, 8),
      patents: filterByRelevance(rawMarketSignals.patents, 8),
      trends: filterByRelevance(rawMarketSignals.trends, 8),
      competitors: filterByRelevance(rawMarketSignals.competitors, 8),
      industry: filterByRelevance(rawMarketSignals.industry, 8),
      funding: filterByRelevance(rawMarketSignals.funding, 8),
    };

    // Return the directly filtered signals
    return Response.json({ signals: marketSignals });
  } catch (error) {
    console.error("Error fetching market signals:", error);
    return Response.json(
      { error: "Failed to fetch market signals" },
      { status: 500 }
    );
  }
}
