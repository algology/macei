import { NewsResponse } from "@/app/components/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signals } = body;

    const NEWS_API_KEY = process.env.NEWS_API_KEY;

    // Parse and extract signals
    let searchTerms = "";
    if (signals) {
      try {
        const parsedSignals = JSON.parse(signals);
        if (Array.isArray(parsedSignals)) {
          searchTerms = parsedSignals.join(" ");
        } else if (
          typeof parsedSignals === "object" &&
          parsedSignals !== null
        ) {
          searchTerms = Object.values(parsedSignals).flat().join(" ");
        } else if (typeof parsedSignals === "string") {
          searchTerms = parsedSignals;
        }
      } catch (e) {
        // If JSON parsing fails, treat as comma-separated string
        searchTerms = signals
          .split(",")
          .map((s: string) => s.trim())
          .join(" ");
      }
    }

    if (!searchTerms) {
      return Response.json({ articles: [] });
    }

    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(
        searchTerms
      )}&sortBy=relevancy&pageSize=3&language=en`,
      {
        headers: {
          Authorization: `Bearer ${NEWS_API_KEY}`,
        },
      }
    );

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("Error fetching news:", error);
    return Response.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
