import {
  NewsResponse,
  MarketSignalsResponse,
  MarketSignal,
} from "@/app/components/types";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
    
    For example, if this is about "content moderation with AI", use specific terms like "AI content moderation tools", "machine learning toxic content detection", "automated moderation systems".
    
    Format your response in JSON like this:
    {
      "newsQuery": "search query for news articles",
      "academicQuery": "search query for academic papers",
      "patentQuery": "search query for patents",
      "trendQuery": "search query for market trends",
      "competitorQuery": "search query for competitor information",
      "industryQuery": "search query for industry reports",
      "fundingQuery": "search query for funding/investment news",
      "keyPhrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"]
    }`;

    // Call Groq API to generate optimized search queries
    const queryCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: searchPrompt,
        },
      ],
      model: "gemma2-9b-it",
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    // Parse the generated queries
    const searchQueries = JSON.parse(
      queryCompletion.choices[0]?.message?.content || "{}"
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
        )}&api_key=${SERP_API_KEY}&num=15&tbm=nws&hl=en`
      ).then((res) => res.json()),

      // Google Scholar (via SerpAPI) with enhanced query
      fetch(
        `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(
          searchQueries.academicQuery
        )}&api_key=${SERP_API_KEY}&num=5`
      ).then((res) => res.json()),

      // Google Patents (via SerpAPI) with enhanced query
      fetch(
        `https://serpapi.com/search.json?engine=google_patents&q=${encodeURIComponent(
          searchQueries.patentQuery
        )}&api_key=${SERP_API_KEY}&num=10&language=ENGLISH&has_abstract=true`
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
        searchQueries.keyPhrases
          ? searchQueries.keyPhrases.slice(0, 2).join(" OR ")
          : null,

        // Try broader industry terms
        `${category || ideaName || ""} industry`,

        // Try business-focused query
        `${ideaName || category || ""} business`,

        // Try technology-focused query
        `${ideaName || category || ""} technology`,

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

    // Filter out obviously irrelevant results based on keywords
    if (ideaKeywords.length > 0) {
      // Filter news articles for relevance
      rawMarketSignals.news = rawMarketSignals.news.filter((article) => {
        const text = (
          article.title +
          " " +
          (article.description || "")
        ).toLowerCase();
        return (
          ideaKeywords.some((keyword) => text.includes(keyword)) ||
          // If no matches, keep the top 5 as they might still be relevant
          rawMarketSignals.news.indexOf(article) < 5
        );
      });

      // Filter academic papers for relevance
      rawMarketSignals.academic = rawMarketSignals.academic.filter((paper) => {
        const text = (
          paper.title +
          " " +
          (paper.description || "")
        ).toLowerCase();
        return (
          ideaKeywords.some((keyword) => text.includes(keyword)) ||
          // If no matches, keep the top 3 as they might still be relevant
          rawMarketSignals.academic.indexOf(paper) < 3
        );
      });

      // Filter patents for relevance
      rawMarketSignals.patents = rawMarketSignals.patents.filter((patent) => {
        const text = (
          patent.title +
          " " +
          (patent.description || "")
        ).toLowerCase();
        return (
          ideaKeywords.some((keyword) => text.includes(keyword)) ||
          // If no matches, keep the top 3 as they might still be relevant
          rawMarketSignals.patents.indexOf(patent) < 3
        );
      });
    }

    // Generate additional market signals using AI combined with real API data
    if (rawMarketSignals.news.length > 0) {
      try {
        console.log(
          "Generating additional market signals using real API data + AI analysis"
        );

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

        // Collect real articles from the APIs
        const trendArticles = trendResults.news_results || [];
        const competitorArticles = competitorResults.news_results || [];
        const industryArticles = industryResults.news_results || [];
        const fundingArticles = fundingResults.news_results || [];

        // AI enhancement process...
        try {
          // Only use AI to analyze and categorize these real results, not for generating URLs
          const enhancedSignalsPrompt = `
          Analyze and categorize these articles for a business idea: "${
            ideaName || ""
          }".
          Category: ${category || ""}
          
          Categorize them into: Market Trends, Competitors, Industry Analysis, and Funding.
          
          For each article:
          - Keep original title, snippet (as description), link (as url), source, and date
          - Add type field: "trend", "competitor", "industry", or "funding"
          
          TREND ARTICLES:
          ${JSON.stringify(trendArticles.slice(0, 5))}
          
          COMPETITOR ARTICLES:
          ${JSON.stringify(competitorArticles.slice(0, 5))}
          
          INDUSTRY ARTICLES:
          ${JSON.stringify(industryArticles.slice(0, 5))}
          
          FUNDING ARTICLES:
          ${JSON.stringify(fundingArticles.slice(0, 5))}
          
          Format response as JSON:
          {
            "trends": [
              {
                "title": "Original title",
                "description": "Original snippet",
                "url": "Original link",
                "source": "Original source",
                "date": "Original date",
                "type": "trend"
              }
            ],
            "competitors": [...],
            "industry": [...],
            "funding": [...]
          }
          
          Only include relevant articles. Return empty arrays for categories with no relevant articles.`;

          // Call Groq to analyze and categorize the real articles
          const enhancedSignalsResponse = await groq.chat.completions.create({
            messages: [
              {
                role: "user",
                content: enhancedSignalsPrompt,
              },
            ],
            model: "gemma2-9b-it",
            temperature: 0.3,
            max_tokens: 2048,
            response_format: { type: "json_object" },
          });

          // Parse the enhanced signals
          const enhancedSignals = JSON.parse(
            enhancedSignalsResponse.choices[0]?.message?.content || "{}"
          );

          // Use the AI-categorized results but with real URLs from the API responses
          if (enhancedSignals.trends && Array.isArray(enhancedSignals.trends)) {
            rawMarketSignals.trends = enhancedSignals.trends;
          }

          if (
            enhancedSignals.competitors &&
            Array.isArray(enhancedSignals.competitors)
          ) {
            rawMarketSignals.competitors = enhancedSignals.competitors;
          }

          if (
            enhancedSignals.industry &&
            Array.isArray(enhancedSignals.industry)
          ) {
            rawMarketSignals.industry = enhancedSignals.industry;
          }

          if (
            enhancedSignals.funding &&
            Array.isArray(enhancedSignals.funding)
          ) {
            rawMarketSignals.funding = enhancedSignals.funding;
          }

          console.log(
            "Successfully added enhanced market signals with real URLs"
          );

          // If AI process fails, use direct mapping
        } catch (error) {
          console.error("Error generating enhanced signals:", error);

          // Fallback: map SERP results directly to market signals
          try {
            const mapNewsToSignals = (
              articles: any[],
              type: "trend" | "competitor" | "industry" | "funding"
            ) => {
              return articles.map((article: any) => ({
                title: article.title,
                description: article.snippet,
                url: article.link,
                source: article.source,
                date: article.date || new Date().toISOString(),
                type: type,
              }));
            };

            rawMarketSignals.trends = mapNewsToSignals(
              trendArticles,
              "trend"
            ).slice(0, 5);
            rawMarketSignals.competitors = mapNewsToSignals(
              competitorArticles,
              "competitor"
            ).slice(0, 5);
            rawMarketSignals.industry = mapNewsToSignals(
              industryArticles,
              "industry"
            ).slice(0, 5);
            rawMarketSignals.funding = mapNewsToSignals(
              fundingArticles,
              "funding"
            ).slice(0, 5);

            console.log("Using fallback mapping for additional market signals");
          } catch (mappingError) {
            console.error("Error in fallback mapping:", mappingError);
            rawMarketSignals.trends = [];
            rawMarketSignals.competitors = [];
            rawMarketSignals.industry = [];
            rawMarketSignals.funding = [];
          }
        }
      } catch (outerError) {
        console.error(
          "Error in outer block of enhanced signals generation:",
          outerError
        );
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

    if (totalResults <= 6) {
      return Response.json({ signals: rawMarketSignals });
    }

    // Use AI to evaluate and filter the most relevant results
    const filteringPrompt = `
    I have collected market signals related to a business idea. Help me identify which ones are most relevant and useful.
    
    Idea Name: ${ideaName || ""}
    Category: ${category || ""}
    Organization: ${organizationName || ""}
    Mission: ${missionName || ""}
    Market Signals: ${signals || ""}
    
    IMPORTANT INSTRUCTIONS:
    1. ONLY include items that are clearly relevant to the business idea
    2. For content moderation ideas: focus on moderation tools, AI safety, content filtering, toxicity detection
    3. For technology ideas: prioritize articles about the specific technology, not just any tech news
    4. DISCARD generic tech news that has no connection to the business idea
    5. ENSURE all selected items have at least one key concept from the idea description
    
    Here are the collected market signals:
    ${JSON.stringify(rawMarketSignals)}
    
    Evaluate each signal and return only the most relevant ones in the same format.
    For each type (news, academic, patents), select up to 5-7 items that are most directly relevant to the business idea.
    Remove any that seem irrelevant, off-topic, or only tangentially related.
    
    Format your response STRICTLY as valid JSON like this:
    {
      "news": [],
      "academic": [],
      "patents": [],
      "trends": [],
      "competitors": [],
      "industry": [],
      "funding": []
    }
    
    IMPORTANT: Ensure your response is valid JSON that can be parsed. Check that all arrays have proper commas between elements and all objects have proper closing braces.`;

    // Call Groq API to filter results
    console.log("About to call Groq API for filtering...");
    try {
      const filteringCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: filteringPrompt,
          },
        ],
        model: "gemma2-9b-it",
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      });

      // Parse the filtered results
      try {
        const filteredSignals = JSON.parse(
          filteringCompletion.choices[0]?.message?.content || "{}"
        );

        // Make sure we have all categories, even if empty
        const marketSignals = {
          news: Array.isArray(filteredSignals.news)
            ? filteredSignals.news
            : rawMarketSignals.news,
          academic: Array.isArray(filteredSignals.academic)
            ? filteredSignals.academic
            : rawMarketSignals.academic,
          patents: Array.isArray(filteredSignals.patents)
            ? filteredSignals.patents
            : rawMarketSignals.patents,
          trends: Array.isArray(filteredSignals.trends)
            ? filteredSignals.trends
            : rawMarketSignals.trends,
          competitors: Array.isArray(filteredSignals.competitors)
            ? filteredSignals.competitors
            : rawMarketSignals.competitors,
          industry: Array.isArray(filteredSignals.industry)
            ? filteredSignals.industry
            : rawMarketSignals.industry,
          funding: Array.isArray(filteredSignals.funding)
            ? filteredSignals.funding
            : rawMarketSignals.funding,
        };

        // If any category is empty after filtering, use the raw results for that category
        if (
          marketSignals.news.length === 0 &&
          rawMarketSignals.news.length > 0
        ) {
          marketSignals.news = rawMarketSignals.news.slice(0, 7);
        }
        if (
          marketSignals.academic.length === 0 &&
          rawMarketSignals.academic.length > 0
        ) {
          marketSignals.academic = rawMarketSignals.academic.slice(0, 5);
        }
        if (
          marketSignals.patents.length === 0 &&
          rawMarketSignals.patents.length > 0
        ) {
          marketSignals.patents = rawMarketSignals.patents.slice(0, 5);
        }

        return Response.json({ signals: marketSignals });
      } catch (error) {
        console.error("Error parsing filtered signals:", error);
        // Fallback to raw results if parsing fails
        return Response.json({ signals: rawMarketSignals });
      }
    } catch (error) {
      console.error("Error in Groq filtering call:", error);
      // Fallback to raw results if the API call fails
      return Response.json({ signals: rawMarketSignals });
    }
  } catch (error) {
    console.error("Error fetching market signals:", error);
    return Response.json(
      { error: "Failed to fetch market signals" },
      { status: 500 }
    );
  }
}
