import { NewsResponse, MarketSignalsResponse } from "@/app/components/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signals } = body;

    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    const SERP_API_KEY = process.env.SERP_API_KEY;

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
                  !["in", "for", "of", "the", "and", "to", "a", "on"].includes(
                    word
                  )
              );
              return [keyTerms.join(" OR ")];
            });
        } else if (typeof parsedSignals === "string") {
          const words = parsedSignals.toLowerCase().split(/\s+/);
          const keyTerms = words.filter(
            (word: string) =>
              !["in", "for", "of", "the", "and", "to", "a", "on"].includes(word)
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
              !["in", "for", "of", "the", "and", "to", "a", "on"].includes(word)
          );
        searchTerms = words.join(" OR ");
      }
    }

    if (!searchTerms) {
      return Response.json({ signals: [] });
    }

    // Increase pageSize for more results
    const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      searchTerms
    )}&sortBy=relevancy&pageSize=5&language=en`;
    console.log("News API Query:", newsApiUrl); // For debugging

    // Fetch from multiple sources in parallel
    const [newsResults, scholarResults, patentsResults] = await Promise.all([
      // News API
      fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(
          searchTerms
        )}&sortBy=relevancy&pageSize=3&language=en`,
        {
          headers: {
            Authorization: `Bearer ${NEWS_API_KEY}`,
          },
        }
      ).then((res) => res.json()),

      // Google Scholar (via SerpAPI)
      fetch(
        `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(
          searchTerms
        )}&api_key=${SERP_API_KEY}&num=3`
      ).then((res) => res.json()),

      // Google Patents (via SerpAPI)
      fetch(
        `https://serpapi.com/search.json?engine=google_patents&q=${encodeURIComponent(
          searchTerms
        )}&api_key=${SERP_API_KEY}&num=10&sort=new&language=ENGLISH`
      ).then((res) => res.json()),
    ]);

    // Process and categorize results
    const marketSignals = {
      news:
        newsResults.articles?.map((article: any) => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          date: article.publishedAt,
          type: "news",
        })) || [],

      academic:
        scholarResults.organic_results?.map((paper: any) => ({
          title: paper.title,
          description: paper.snippet,
          url: paper.link,
          source: paper.publication_info?.summary || "Academic Paper",
          date: paper.publication_info?.year
            ? new Date(paper.publication_info.year, 0).toISOString()
            : paper.publication_info?.published_date || "N/A",
          type: "academic",
        })) || [],

      patents:
        (patentsResults.organic_results?.slice(0, 3) || []).map(
          (patent: any) => ({
            title: patent.title,
            description: patent.snippet,
            url: patent.patent_link,
            source: patent.assignee || "Patent",
            date: patent.publication_date || patent.filing_date || "N/A",
            type: "patent",
            patentNumber: patent.publication_number,
            status:
              Object.entries(patent.country_status || {})[0]?.[1] || "N/A",
            inventor: patent.inventor || "N/A",
          })
        ) || [],
    };

    return Response.json({ signals: marketSignals });
  } catch (error) {
    console.error("Error fetching market signals:", error);
    return Response.json(
      { error: "Failed to fetch market signals" },
      { status: 500 }
    );
  }
}
