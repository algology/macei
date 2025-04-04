import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import Groq from "groq-sdk";
import JSON5 from "json5";
import { createNotification } from "@/lib/notificationService";
import { sendEmail, generateBriefingEmail } from "@/lib/emailService";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to sample signals to reduce context size
function sampleSignals(signals: any[], maxPerCategory: number) {
  if (!signals || signals.length <= maxPerCategory) return signals || [];

  // Ensure we get a diverse sample by shuffling and then taking the first N
  const shuffled = [...signals].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, maxPerCategory);
}

// Helper function to filter and prioritize the most relevant signals
function prioritizeSignals(signals: any[], maxTotal: number = 15) {
  if (!signals || signals.length === 0) return [];

  // Create a scoring function to rank signals by potential relevance
  const scoreSignal = (signal: any): number => {
    let score = 0;

    // Prioritize signals with more complete information
    if (signal.title && signal.title.length > 10) score += 3;
    if (signal.description && signal.description.length > 50) score += 5;
    if (signal.url && signal.url.startsWith("http")) score += 4;

    // Prioritize newer signals
    if (signal.date) {
      const date = new Date(signal.date);
      if (!isNaN(date.getTime())) {
        // Higher score for more recent signals
        const daysDiff = Math.floor(
          (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff < 7) score += 10;
        else if (daysDiff < 30) score += 5;
        else if (daysDiff < 90) score += 2;
      }
    }

    // Prioritize specific source types
    if (signal.type === "news" || signal.type === "academic") score += 3;

    return score;
  };

  // Score and sort signals
  const scoredSignals = signals.map((signal) => ({
    signal,
    score: scoreSignal(signal),
  }));

  scoredSignals.sort((a, b) => b.score - a.score);

  // Return top N signals
  return scoredSignals.slice(0, maxTotal).map((item) => item.signal);
}

// Helper function to prepare summarized signals context
function prepareSummarizedSignalsContext(freshMarketSignals: any) {
  if (!freshMarketSignals) return "";

  // Sample signals from each category to limit the total size
  const sampledNews = sampleSignals(freshMarketSignals.news || [], 3);
  const sampledAcademic = sampleSignals(freshMarketSignals.academic || [], 2);
  const sampledPatents = sampleSignals(freshMarketSignals.patents || [], 2);
  const sampledTrends = sampleSignals(freshMarketSignals.trends || [], 2);
  const sampledCompetitors = sampleSignals(
    freshMarketSignals.competitors || [],
    2
  );
  const sampledIndustry = sampleSignals(freshMarketSignals.industry || [], 2);
  const sampledFunding = sampleSignals(freshMarketSignals.funding || [], 2);

  // Just log top-level titles/descriptions for these signals to reduce size
  const formatSummary = (signals: any[], category: string) => {
    if (!signals || signals.length === 0) return "";

    return signals
      .map(
        (signal) =>
          `${category} Signal: ${signal.title}\nDescription: ${
            signal.description ? signal.description.substring(0, 150) : "N/A"
          }\nURL: ${signal.url}`
      )
      .join("\n\n");
  };

  // Create summarized context
  return [
    formatSummary(sampledNews, "News"),
    formatSummary(sampledAcademic, "Academic"),
    formatSummary(sampledPatents, "Patent"),
    formatSummary(sampledTrends, "Trend"),
    formatSummary(sampledCompetitors, "Competitor"),
    formatSummary(sampledIndustry, "Industry"),
    formatSummary(sampledFunding, "Funding"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Helper function to fetch content for a limited set of URLs
async function fetchLimitedUrlContent(signals: any[], maxUrls: number) {
  const allSignals = Array.isArray(signals) ? signals : [];
  if (allSignals.length === 0) return [];

  // Prioritize which URLs to fetch content for - ensure they are valid
  const prioritizedUrls = allSignals
    .filter(
      (signal) =>
        signal.url &&
        signal.url.startsWith("http") &&
        !signal.url.includes("example.com")
    )
    .slice(0, maxUrls);

  console.log(
    `Fetching content for ${prioritizedUrls.length} prioritized URLs`
  );

  // Use a shorter timeout for URL content fetching to avoid long delays
  const fetchWithTimeout = async (
    url: string,
    signal: any,
    timeout: number = 15000
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        }/api/fetch-url-content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: signal.url, priority: "high" }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL content: ${response.status}`);
      }

      const data = await response.json();

      return {
        url: signal.url,
        title: signal.title,
        content: data.content || signal.description || "Content not available",
        source: signal.source || "Market Signal",
        type: signal.type || "unknown",
        error: data.error,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      return {
        url: signal.url,
        title: signal.title,
        content: signal.description || "Failed to fetch content",
        source: signal.source || "Market Signal",
        type: signal.type || "unknown",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  // Fetch content for prioritized URLs with parallel processing and timeouts
  const results = await Promise.all(
    prioritizedUrls.map((signal) => fetchWithTimeout(signal.url, signal))
  );

  return results.map((result) => ({ status: "fulfilled", value: result }));
}

// Helper function to create structured JSON format prompt
function createJsonStructurePrompt() {
  return `
THE RESPONSE MUST BE A VALID JSON OBJECT WITH THIS EXACT STRUCTURE:
{
  "summary": "string with 5-6 sentences highlighting specific quantitative data, major announcements, policy shifts, and technological innovations",
  "details": [
    {"summary": "Concise 1-2 sentence summary focused on key novel insight", "url": "source URL", "emoji": "🔍", "source_name": "Source Name"},
    {"summary": "Concise 1-2 sentence summary focused on key novel insight", "url": "source URL", "emoji": "📊", "source_name": "Source Name"},
    {"summary": "Concise 1-2 sentence summary focused on key novel insight", "url": "source URL", "emoji": "🏭", "source_name": "Source Name"},
    {"summary": "Concise 1-2 sentence summary focused on key novel insight", "url": "source URL", "emoji": "🌱", "source_name": "Source Name"},
    {"summary": "Concise 1-2 sentence summary focused on key novel insight", "url": "source URL", "emoji": "💡", "source_name": "Source Name"}
  ],
  "key_attributes": ["string1", "string2", "string3", "string4", "string5"],
  "suggested_signals": [
    "carbon capture technology investment",
    "geological storage innovations",
    "carbon pricing policy changes",
    "oil and gas industry transition strategies",
    "corporate carbon neutrality commitments"
  ]
}
`;
}

// Helper function to create the briefing generation prompt
function createBriefingPrompt(combinedContext: string) {
  return `Generate a comprehensive briefing about this business idea as valid JSON according to the following guidelines:

${combinedContext}

IMPORTANT BRIEFING GUIDELINES:
1. SUMMARY SECTION:
   - Write 5-6 sentences highlighting the most important NOVEL insights from the period
   - Include specific quantitative data where available
   - Mention major announcements from companies in the space
   - Note significant policy shifts or regulatory changes
   - Highlight relevant technological innovations
   - AVOID generic trends - be specific and data-driven

2. DETAILS SECTION:
   - For each source, include a concise 1-2 sentence summary that captures the KEY NOVEL INSIGHT
   - Include a meaningful source_name that identifies the publisher (e.g., "Fortune India", "Bloomberg", "Reuters")
   - Choose an appropriate emoji for each detail that represents the content theme:
     * Use 📊 for market data, statistics, or financial information
     * Use 🏭 for industry news or manufacturing developments
     * Use 🔬 for research or scientific breakthroughs
     * Use 📱 for technology or innovation news
     * Use 📈 for growth or investment trends
     * Use 🌱 for sustainability or environmental developments
     * Use 🏛️ for regulatory or policy news
     * Use 💡 for new ideas or concept innovations
     * Use 📧 for email content or user-submitted information
     * Use relevant emojis for other categories
   - Include working URLs to the original sources
   - IMPORTANT: Ensure any content from emails or user submissions uses the 📧 emoji

3. KEY ATTRIBUTES SECTION:
   - Note: The key attributes will be taken from the idea's existing attributes, so whatever you put here will be ignored
   - Just include some placeholder values

4. SUGGESTED SIGNALS SECTION:
   - This section is VERY IMPORTANT
   - Based on your analysis of the market data, suggest 5-8 SPECIFIC new market signals that would be valuable to track
   - These should be concrete, specific terms (NOT generic categories like "technology trends")
   - Each signal should be directly relevant to the idea and current market developments
   - DO NOT use placeholders - suggest real, meaningful signals based on gaps in the current market research
   - Examples: "carbon capture efficiency improvements", "corporate ESG investment trends", "renewable energy storage costs"

${createJsonStructurePrompt()}

OUTPUT REQUIREMENTS:
1. ONLY output valid JSON - no markdown, no explanations
2. Ensure all URLs in the details section are real URLs from the provided context
3. Use appropriate thematic emojis instead of flag emojis
4. The details section should contain exactly 5 items
5. The suggested_signals section must contain 5-8 meaningful, specific market signals to track (not placeholders)
6. For any emailed content or user-submitted information, ensure the emoji is 📧`;
}

// Helper function to prepare URL content in a more structured format
function prepareStructuredUrlContent(urlContents: any[]) {
  if (!urlContents || urlContents.length === 0) {
    return "No URL content available";
  }

  return urlContents
    .map((data, index) => {
      // Extract the domain name for easier source identification
      let domain = "";
      try {
        if (data.url) {
          const urlObj = new URL(data.url);
          domain = urlObj.hostname.replace(/^www\./, "");
        }
      } catch (e) {
        domain = "unknown-source";
      }

      // Create a structured representation of the URL content
      return `SOURCE ${index + 1}: ${data.title || "Untitled Source"}
URL: ${data.url}
DOMAIN: ${domain}
TYPE: ${data.type || "General"}
KEY EXCERPTS:
${
  data.content
    ? data.content
        .substring(0, 800)
        .split("\n")
        .map((line: string) => `  ${line}`)
        .join("\n")
    : "No content available"
}
${data.content && data.content.length > 800 ? "...(content truncated)" : ""}`;
    })
    .join("\n\n");
}

// Helper function to optimize context for smaller LLMs
function createOptimizedContext(
  idea: any,
  effectiveDescription: string,
  summarizedSignals: string,
  urlContents: any[]
) {
  // Create a structured URL content format
  const structuredUrlContent = prepareStructuredUrlContent(urlContents);

  // Create a compact version to fit in smaller context windows
  return `
IDEA: ${idea.name}
DESCRIPTION: ${effectiveDescription.substring(0, 300)}${
    effectiveDescription.length > 300 ? "..." : ""
  }
${idea.category ? `CATEGORY: ${idea.category}` : ""}
${idea.mission?.name ? `MISSION: ${idea.mission.name}` : ""}
${
  idea.mission?.organization?.industry
    ? `INDUSTRY: ${idea.mission.organization.industry}`
    : ""
}

KEY MARKET SIGNALS:
${summarizedSignals}

DETAILED SOURCE CONTENT:
${structuredUrlContent}
`;
}

// Helper function to create a minimal fallback prompt
function createFallbackPrompt(idea: any, effectiveDescription: string) {
  return `Generate a detailed briefing about this business idea in JSON format, focusing on analysis of its market viability.

IDEA: ${idea.name}
BRIEF DESCRIPTION: ${effectiveDescription.substring(0, 200)}...
${idea.category ? `CATEGORY: ${idea.category}` : ""}

IMPORTANT GUIDELINES:
1. Summary: Provide 5-6 specific, data-driven sentences with novel insights
2. Details: Include 5 items with appropriate thematic emojis (📊 for data, 🏭 for industry, 🔬 for research, etc.)
3. Key Attributes: These will be taken from the existing idea, just include placeholders
4. Suggested Signals: Provide 5-8 SPECIFIC new market signals to track based on the idea - these must be concrete terms, not placeholders

${createJsonStructurePrompt()}

CRITICAL: Your entire response must be ONLY valid JSON with no additional text.
CRITICAL: The suggested_signals must be actual specific market signals (like "hydrogen fuel cell efficiency improvements"), not placeholders like "string1".`;
}

// Helper function to ensure proper thematic emojis in details
function ensureProperEmojis(details: any[]) {
  if (!Array.isArray(details)) return [];

  // Define a set of valid thematic emojis
  const validEmojis = [
    "📊", // charts, data, statistics
    "🏭", // industry, manufacturing
    "🔬", // research, science
    "📱", // technology, digital
    "📈", // growth, trends
    "🌱", // sustainability, environment
    "🏛️", // regulation, policy
    "💡", // ideas, innovation
    "🔍", // insights, analysis
    "🤝", // partnerships, deals
    "💰", // finance, funding
    "🔋", // energy
    "🛢️", // oil, fossil fuels
    "⚡", // electricity, power
    "🚀", // startups, launch
    "🧪", // testing, experiments
    "🌐", // global, internet
    "📧", // email, user-submitted
  ];
  const defaultEmoji = "💡";

  return details.map((detail) => {
    // Check if emoji field exists and is a string
    if (!detail.emoji && detail.country) {
      // Handle case where we're migrating from country to emoji
      detail.emoji = detail.country;
      delete detail.country;
    }

    if (!detail.emoji || typeof detail.emoji !== "string") {
      return { ...detail, emoji: defaultEmoji };
    }

    // Check if the emoji field contains a valid emoji
    const isValidEmoji = validEmojis.includes(detail.emoji);
    if (isValidEmoji) {
      return detail;
    }

    // Attempt to choose a contextually appropriate emoji based on the summary
    if (detail.summary) {
      const summary = detail.summary.toLowerCase();

      // Special case for email/user submitted content
      if (
        summary.includes("email") ||
        summary.includes("submitted") ||
        summary.includes("user") ||
        (detail.source &&
          typeof detail.source === "string" &&
          detail.source.toLowerCase().includes("email"))
      ) {
        return { ...detail, emoji: "📧" };
      }

      if (
        summary.includes("data") ||
        summary.includes("statistics") ||
        summary.includes("report")
      )
        return { ...detail, emoji: "📊" };
      if (summary.includes("industry") || summary.includes("manufacturing"))
        return { ...detail, emoji: "🏭" };
      if (
        summary.includes("research") ||
        summary.includes("science") ||
        summary.includes("study")
      )
        return { ...detail, emoji: "🔬" };
      if (
        summary.includes("technology") ||
        summary.includes("digital") ||
        summary.includes("tech")
      )
        return { ...detail, emoji: "📱" };
      if (
        summary.includes("growth") ||
        summary.includes("market") ||
        summary.includes("increase")
      )
        return { ...detail, emoji: "📈" };
      if (
        summary.includes("sustainable") ||
        summary.includes("environment") ||
        summary.includes("green")
      )
        return { ...detail, emoji: "🌱" };
      if (
        summary.includes("regulation") ||
        summary.includes("policy") ||
        summary.includes("government")
      )
        return { ...detail, emoji: "🏛️" };
      if (
        summary.includes("innovation") ||
        summary.includes("new") ||
        summary.includes("idea")
      )
        return { ...detail, emoji: "💡" };
      if (
        summary.includes("partnership") ||
        summary.includes("collaboration") ||
        summary.includes("agreement")
      )
        return { ...detail, emoji: "🤝" };
      if (
        summary.includes("funding") ||
        summary.includes("investment") ||
        summary.includes("financial")
      )
        return { ...detail, emoji: "💰" };
      if (summary.includes("energy") || summary.includes("power"))
        return { ...detail, emoji: "🔋" };
      if (
        summary.includes("oil") ||
        summary.includes("gas") ||
        summary.includes("fossil")
      )
        return { ...detail, emoji: "🛢️" };
      if (summary.includes("electricity") || summary.includes("grid"))
        return { ...detail, emoji: "⚡" };
      if (summary.includes("startup") || summary.includes("launch"))
        return { ...detail, emoji: "🚀" };
      if (summary.includes("test") || summary.includes("experiment"))
        return { ...detail, emoji: "🧪" };
      if (
        summary.includes("global") ||
        summary.includes("worldwide") ||
        summary.includes("internet")
      )
        return { ...detail, emoji: "🌐" };
    }

    // Use default emoji if none matched
    return { ...detail, emoji: defaultEmoji };
  });
}

// Helper function to select the most appropriate model based on context size
function selectAppropriateModel(contextSize: number) {
  // Thresholds based on approximate token counts
  // Assuming ~4 characters per token as a rough estimate
  const estimatedTokens = Math.ceil(contextSize / 4);

  console.log(`Estimated token count for context: ~${estimatedTokens}`);

  // Model selection logic
  if (estimatedTokens < 8000) {
    // For smaller contexts, gemma2-9b-it is fast and efficient
    return "deepseek-r1-distill-qwen-32b";
  } else if (estimatedTokens < 16000) {
    // For medium contexts, llama3-70b-8192 provides good quality
    return "deepseek-r1-distill-qwen-32b";
  } else {
    // For larger contexts, use the model with largest context window
    return "deepseek-r1-distill-qwen-32b";
  }
}

// Helper function to extract source name from URL
function extractSourceNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    
    // Special case handling for common domains
    if (hostname.includes("github.com")) return "GitHub";
    if (hostname.includes("medium.com")) return "Medium";
    if (hostname.includes("techcrunch.com")) return "TechCrunch";
    if (hostname.includes("forbes.com")) return "Forbes";
    if (hostname.includes("bloomberg.com")) return "Bloomberg";
    if (hostname.includes("reuters.com")) return "Reuters";
    if (hostname.includes("bbc.")) return "BBC";
    if (hostname.includes("nytimes.com")) return "New York Times";
    if (hostname.includes("wsj.com")) return "Wall Street Journal";
    if (hostname.includes("economist.com")) return "The Economist";
    if (hostname.includes("wired.com")) return "Wired";
    if (hostname.includes("cnn.com")) return "CNN";
    if (hostname.includes("theverge.com")) return "The Verge";
    if (hostname.includes("springer.com")) return "Springer";
    if (hostname.includes("nature.com")) return "Nature";
    if (hostname.includes("sciencedirect.com")) return "ScienceDirect";
    if (hostname.includes("arxiv.org")) return "arXiv";
    if (hostname.includes("aljazeera.com")) return "Al Jazeera";
    if (hostname.includes("morningstar.com")) return "Morningstar";
    if (hostname.includes("fortuneindia.com")) return "Fortune India";
    
    // For domains with multiple parts, use the second-to-last part (typically the main domain name)
    const domainParts = hostname.split(".");
    if (domainParts.length >= 2) {
      // Capitalize the first letter
      const mainName = domainParts[domainParts.length - 2];
      return mainName.charAt(0).toUpperCase() + mainName.slice(1);
    }
    
    // Default fallback
    return hostname;
  } catch (e) {
    console.error("Error extracting source name from URL:", e);
    return "Source";
  }
}

export async function POST(request: Request) {
  try {
    // Get request data
    const requestJsonText = await request.text();
    console.log("========== RAW REQUEST RECEIVED ==========");
    console.log("Raw request text:", requestJsonText);

    let requestJson;
    try {
      requestJson = JSON.parse(requestJsonText);
      console.log("Successfully parsed JSON");
    } catch (parseError) {
      console.error("ERROR PARSING JSON:", parseError);
      console.log("Attempting to fix malformed JSON...");
      // Attempt to fix common JSON issues
      const fixedText = requestJsonText
        .replace(/(\w+):/g, '"$1":') // Add quotes to keys
        .replace(/'/g, '"'); // Replace single quotes with double quotes

      try {
        requestJson = JSON.parse(fixedText);
        console.log("Successfully parsed fixed JSON");
      } catch (fixedParseError) {
        console.error(
          "Still failed to parse JSON after fixing:",
          fixedParseError
        );
        // Create a fallback request object
        requestJson = {
          ideaId: parseInt(
            new URL(request.url).searchParams.get("ideaId") || "0"
          ),
          isAutomatic:
            new URL(request.url).searchParams.get("isAutomatic") === "true",
        };
        console.log("Using fallback request object:", requestJson);
      }
    }

    console.log("Raw JSON object:", requestJson);
    console.log("Data types in request:", {
      ideaId: typeof requestJson.ideaId,
      ideaName: typeof requestJson.ideaName,
      isAutomatic: typeof requestJson.isAutomatic,
      debugMode: typeof requestJson.debugMode,
    });
    console.log("==========================================");

    const {
      ideaId,
      ideaName,
      isAutomatic: rawIsAutomatic = false,
      debugMode = false,
    } = requestJson;

    // Explicitly convert to boolean to handle string values like "true"
    // Use double equal for string "true" compatibility
    const isAutomatic = rawIsAutomatic == true;

    console.log("===== PROCESSED REQUEST VALUES =====");
    console.log("ideaId:", ideaId);
    console.log("ideaName:", ideaName);
    console.log(
      "rawIsAutomatic:",
      rawIsAutomatic,
      "type:",
      typeof rawIsAutomatic
    );
    console.log(
      "isAutomatic (parsed):",
      isAutomatic,
      "type:",
      typeof isAutomatic
    );
    console.log("isAutomatic == true:", rawIsAutomatic == true);
    console.log("debugMode:", debugMode);
    console.log("====================================");

    console.log(
      "Received request for idea:",
      ideaId,
      isAutomatic ? "(automated)" : "(manual)",
      debugMode ? "(debug mode)" : ""
    );

    // Initialize supabase with service role
    const supabase = getServerSupabase();

    // Get idea details
    const { data: idea, error: ideaError } = await supabase
      .from("ideas")
      .select(
        `
        *,
        mission:missions (
          *,
          organization:organizations (*)
        )
      `
      )
      .eq("id", ideaId)
      .single();

    if (ideaError) {
      console.error("Error fetching idea:", ideaError);
      throw ideaError;
    }

    if (!idea) {
      throw new Error("Idea not found");
    }

    console.log("Fetched idea:", idea.name);

    // Validate that the idea has sufficient information for generating a briefing
    if (
      (!idea.description || idea.description.trim() === "") &&
      (!idea.summary || idea.summary.trim() === "")
    ) {
      console.error(
        "Idea lacks both description and summary, cannot generate briefing"
      );
      return NextResponse.json(
        {
          error:
            "Cannot generate briefing: Idea description or summary is missing. Please add a description or summary to your idea first.",
        },
        { status: 400 }
      );
    }

    // If we only have summary but no description, use summary as the description for the briefing
    const effectiveDescription =
      idea.description && idea.description.trim() !== ""
        ? idea.description
        : idea.summary || "";

    console.log(
      "Using effective description for briefing:",
      effectiveDescription.length > 50
        ? effectiveDescription.substring(0, 50) + "..."
        : effectiveDescription
    );

    // Check for minimal required information
    const missingFields = [];
    if (!idea.category || idea.category.trim() === "")
      missingFields.push("category");
    if (!idea.mission?.name || idea.mission.name.trim() === "")
      missingFields.push("mission name");
    if (
      !idea.mission?.organization?.industry ||
      idea.mission.organization.industry.trim() === ""
    )
      missingFields.push("industry");

    if (missingFields.length > 0) {
      const fieldList = missingFields.join(", ");
      console.warn(`Idea is missing some recommended fields: ${fieldList}`);
      // Continue with generation but log the warning
    }

    // Get fresh market signals directly from the API
    console.log("Fetching fresh market signals from API...");
    let freshMarketSignals: {
      news?: any[];
      academic?: any[];
      patents?: any[];
      trends?: any[];
      competitors?: any[];
      industry?: any[];
      funding?: any[];
    } | null = null;
    try {
      // Call the fetch-market-signals API with a longer timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout instead of default

      const signalsResponse = await fetch(
        `${
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        }/api/fetch-market-signals`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ideaName: idea.name,
            category: idea.category,
            signals: idea.signals,
            missionName: idea.mission?.name,
            organizationName: idea.mission?.organization?.name,
            aiAnalysis: idea.ai_analysis,
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!signalsResponse.ok) {
        throw new Error(
          `Failed to fetch market signals: ${signalsResponse.statusText}`
        );
      }

      const signalsData = await signalsResponse.json();
      freshMarketSignals = signalsData.signals;
      console.log("Successfully fetched fresh market signals");

      // Log the fresh market signals details to ensure we're getting data
      if (freshMarketSignals) {
        console.log("Fresh market signals details:");
        console.log(`- News: ${freshMarketSignals.news?.length || 0} items`);
        console.log(
          `- Academic: ${freshMarketSignals.academic?.length || 0} items`
        );
        console.log(
          `- Patents: ${freshMarketSignals.patents?.length || 0} items`
        );
        console.log(
          `- Trends: ${freshMarketSignals.trends?.length || 0} items`
        );
        console.log(
          `- Competitors: ${freshMarketSignals.competitors?.length || 0} items`
        );
        console.log(
          `- Industry: ${freshMarketSignals.industry?.length || 0} items`
        );
        console.log(
          `- Funding: ${freshMarketSignals.funding?.length || 0} items`
        );
      }
    } catch (error) {
      console.error("Error fetching fresh market signals:", error);
      // Continue with the process even if fresh signals fail
    }

    // Get documents for this idea
    const { data: documents, error: docsError } = await supabase
      .from("idea_documents")
      .select("*")
      .eq("idea_id", ideaId);

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      throw docsError;
    }

    console.log("Found documents:", documents?.length || 0);

    // Get the last briefing date to determine the date range
    const { data: lastBriefings, error: briefingError } = await supabase
      .from("briefings")
      .select("date_to")
      .eq("idea_id", ideaId)
      .order("date_to", { ascending: false })
      .limit(1);

    if (briefingError) {
      console.error("Error fetching last briefing:", briefingError);
      throw briefingError;
    }

    const dateFrom =
      lastBriefings?.[0]?.date_to ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = new Date().toISOString();

    console.log("Date range:", { dateFrom, dateTo });

    // Now also fetch market signals from the knowledge_base table
    const { data: knowledgeBaseSignals, error: signalsError } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("idea_id", ideaId)
      .order("relevance_score", { ascending: false })
      .limit(50); // Increase limit to get more signals

    if (signalsError) {
      console.error("Error fetching market signals:", signalsError);
      throw signalsError;
    }

    console.log(
      "Found knowledge base signals:",
      knowledgeBaseSignals?.length || 0
    );

    // Separate emailed signals from other knowledge base signals
    const emailedSignals =
      knowledgeBaseSignals?.filter(
        (signal) => signal.metadata?.is_user_submitted
      ) || [];
    const otherSignals =
      knowledgeBaseSignals?.filter(
        (signal) => !signal.metadata?.is_user_submitted
      ) || [];

    console.log(
      `Found ${emailedSignals.length} emailed signals and ${otherSignals.length} other signals`
    );

    // Combine signals, ensuring we don't exceed a reasonable limit
    // Prioritize emailed signals by putting them first
    const limitedKnowledgeSignals = [...emailedSignals, ...otherSignals].slice(
      0,
      50
    );

    // Process and sample market signals to keep prompt size manageable
    console.log(
      "Processing and sampling market signals to optimize context size..."
    );

    let allFreshSignals: any[] = [];
    if (freshMarketSignals) {
      // Combine all signals into a single array for processing
      allFreshSignals = [
        ...(freshMarketSignals.news || []),
        ...(freshMarketSignals.academic || []),
        ...(freshMarketSignals.patents || []),
        ...(freshMarketSignals.trends || []),
        ...(freshMarketSignals.competitors || []),
        ...(freshMarketSignals.industry || []),
        ...(freshMarketSignals.funding || []),
      ];

      console.log(
        `Total fresh signals before optimization: ${allFreshSignals.length}`
      );

      // Prioritize the most relevant signals
      const prioritizedSignals = prioritizeSignals(allFreshSignals, 15);
      console.log(
        `Selected ${prioritizedSignals.length} prioritized signals based on relevance`
      );

      // Use the prioritized signals for fetching content
      allFreshSignals = prioritizedSignals;
    }

    // Create a summarized version of the signals context to reduce size
    let summarizedSignalsContext =
      prepareSummarizedSignalsContext(freshMarketSignals);

    // Add emailed signals to the context if they exist
    if (emailedSignals.length > 0) {
      const emailedSignalsContext = `USER-SUBMITTED SIGNALS:\n${emailedSignals
        .map(
          (signal) =>
            `Title: ${signal.title}\nDescription: ${signal.content}\nURL: ${signal.source_url}\nDate: ${signal.publication_date}`
        )
        .join("\n\n")}`;

      summarizedSignalsContext = `${emailedSignalsContext}\n\n${summarizedSignalsContext}`;
    }

    // Fetch content for just a limited number of high-priority URLs
    console.log("Fetching content for a limited set of high-priority URLs...");

    // Modified fetchLimitedUrlContent to report progress for each URL
    const fetchUrlWithProgress = async (signal: any) => {
      try {
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          }/api/fetch-url-content`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: signal.url, priority: "high" }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch URL content: ${response.status}`);
        }

        const data = await response.json();

        return {
          url: signal.url,
          title: signal.title,
          content:
            data.content || signal.description || "Content not available",
          source: signal.source || "Market Signal",
          type: signal.type || "unknown",
          error: data.error,
        };
      } catch (error) {
        return {
          url: signal.url,
          title: signal.title,
          content: signal.description || "Failed to fetch content",
          source: signal.source || "Market Signal",
          type: signal.type || "unknown",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Select prioritized URLs for content fetching
    const freshUrls = allFreshSignals
      .filter(
        (signal) =>
          signal.url &&
          signal.url.startsWith("http") &&
          !signal.url.includes("example.com")
      )
      .slice(0, 4); // Reduce to 4 to make room for emailed signals

    // Get URLs from emailed signals
    const emailedUrls = emailedSignals
      .filter(
        (signal) =>
          signal.source_url &&
          signal.source_url.startsWith("http") &&
          !signal.source_url.includes("example.com")
      )
      .slice(0, 4); // Take up to 4 emailed signal URLs

    // Combine and fetch content for all URLs
    const prioritizedUrls = [...freshUrls, ...emailedUrls];
    const urlResults = await Promise.all(
      prioritizedUrls.map(fetchUrlWithProgress)
    );

    // Add emailed signal content directly to the results
    const successfulUrlContents = [
      ...urlResults,
      ...emailedSignals.map((signal) => ({
        url: signal.source_url,
        title: `📧 [Email] ${signal.title}`,
        content: signal.content,
        source: "Email Signal",
        type: "email",
        error: null,
      })),
    ];

    console.log(
      `Successfully fetched content for ${successfulUrlContents.length} URLs (including ${emailedSignals.length} emailed signals)`
    );

    // Create URL content context with truncated content
    const urlContentContext = successfulUrlContents;

    // Create a smaller, more focused context for the LLM
    const combinedContext = createOptimizedContext(
      idea,
      effectiveDescription,
      summarizedSignalsContext,
      successfulUrlContents
    );

    console.log(`Optimized context size: ${combinedContext.length} characters`);

    // Add all URLs to a collection for potential use in the briefing
    let allUrls: string[] = [];
    if (freshMarketSignals) {
      const extractUrls = (signals: any[] = []) =>
        signals
          .filter((s) => s.url && s.url.startsWith("http"))
          .map((s) => s.url);

      allUrls = [
        ...extractUrls(freshMarketSignals.news || []),
        ...extractUrls(freshMarketSignals.academic || []),
        ...extractUrls(freshMarketSignals.patents || []),
        ...extractUrls(freshMarketSignals.trends || []),
        ...extractUrls(freshMarketSignals.competitors || []),
        ...extractUrls(freshMarketSignals.industry || []),
        ...extractUrls(freshMarketSignals.funding || []),
      ];
    }

    console.log(
      `Collected ${allUrls.length} URLs for potential use in briefing`
    );

    // Parse the signals from the idea so it's available throughout the function
    let ideaSignals: string[] = [];
    try {
      ideaSignals = idea.signals ? (JSON.parse(idea.signals) as string[]) : [];
      // Handle both array and object formats
      if (!Array.isArray(ideaSignals)) {
        if (typeof ideaSignals === "object" && ideaSignals !== null) {
          // If it's an object with categories, flatten all values into an array
          ideaSignals = Object.values(ideaSignals).flat() as string[];
        } else {
          // If it's a string, split by commas
          ideaSignals = idea.signals.split(",").map((s: string) => s.trim());
        }
      }
    } catch (error) {
      console.error("Error parsing signals:", error);
      // If parsing fails, try splitting by comma
      ideaSignals = idea.signals
        ? idea.signals.split(",").map((s: string) => s.trim())
        : [];
    }

    // Log the sources we're using to ensure we're actually using fetch-market-signals data
    console.log("Using the following sources for briefing generation:");
    console.log(`- Knowledge base signals: ${limitedKnowledgeSignals.length}`);
    console.log(
      `- Fresh market signals: ${
        freshMarketSignals ? "Yes - using fetch-market-signals data" : "No"
      }`
    );
    if (freshMarketSignals) {
      console.log(`  - News: ${freshMarketSignals.news?.length || 0}`);
      console.log(`  - Academic: ${freshMarketSignals.academic?.length || 0}`);
      console.log(`  - Patents: ${freshMarketSignals.patents?.length || 0}`);
      // Add more logging for other signal types
    }
    console.log(`- URL content sources: ${successfulUrlContents.length}`);
    console.log(`- Documents: ${documents?.length || 0}`);

    // Create a prompt that instructs the model to directly generate valid JSON
    const jsonPrompt = createBriefingPrompt(combinedContext);

    // Dynamically select the appropriate model based on context size
    const selectedModel = selectAppropriateModel(jsonPrompt.length);
    console.log(`Selected model for briefing generation: ${selectedModel}`);

    // Use a structured output format with model selection based on context size
    try {
      console.log(`Using ${selectedModel} for briefing generation`);

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are an expert business analyst specializing in creating insightful briefings from market signals. Your briefings are data-driven, specific, and highly relevant to the business idea being analyzed. You analyze how recent developments impact the idea's viability rather than restating what the idea is.",
          },
          {
            role: "user",
            content: jsonPrompt,
          },
        ],
        model: selectedModel,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      console.log("Received response from Groq");

      let briefingContent = completion.choices[0]?.message?.content;
      if (!briefingContent) {
        throw new Error("No content received from Groq");
      }

      console.log("Raw response length:", briefingContent.length);

      // Enhanced JSON parsing with multiple fallback options
      let parsedBriefing;
      try {
        // First attempt: Direct JSON.parse
        parsedBriefing = JSON.parse(briefingContent);
        console.log("Successfully parsed JSON with standard JSON.parse");
      } catch (jsonError) {
        console.error("Error with standard JSON.parse:", jsonError);

        try {
          // Second attempt: Use JSON5 which is more forgiving
          parsedBriefing = JSON5.parse(briefingContent);
          console.log("Successfully parsed with JSON5");
        } catch (json5Error) {
          console.error("Error with JSON5 parsing:", json5Error);

          // Third attempt: Extract JSON object and try with regular expressions fixes
          try {
            let extractedJson = briefingContent;

            // Handle markdown code blocks
            if (extractedJson.includes("```json")) {
              const match = extractedJson.match(/```json\s*([\s\S]*?)\s*```/);
              if (match && match[1]) {
                extractedJson = match[1].trim();
              }
            } else if (extractedJson.includes("```")) {
              const match = extractedJson.match(/```\s*([\s\S]*?)\s*```/);
              if (match && match[1]) {
                extractedJson = match[1].trim();
              }
            }

            // Find JSON object boundaries if present
            const jsonStart = extractedJson.indexOf("{");
            const jsonEnd = extractedJson.lastIndexOf("}");

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              extractedJson = extractedJson.substring(jsonStart, jsonEnd + 1);
            }

            // Apply fixes to common JSON issues
            let fixedJson = extractedJson
              // Remove control characters that break JSON
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
              // Fix trailing commas in arrays and objects
              .replace(/,\s*]/g, "]")
              .replace(/,\s*}/g, "}")
              // Fix missing quotes around property names
              .replace(/(\s*?)(\w+)(\s*?):/g, '"$2":')
              // Fix single quotes used instead of double quotes around property names
              .replace(/'([^']+)'(\s*?):/g, '"$1":')
              // Fix single quotes used instead of double quotes around string values
              .replace(/:\s*'([^']*)'/g, ':"$1"')
              // Fix unescaped quotes within string values
              .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, function (match, p1) {
                return '"' + p1.replace(/"/g, '\\"') + '"';
              });

            parsedBriefing = JSON.parse(fixedJson);
            console.log("Successfully parsed JSON after applying fixes");
          } catch (fixedJsonError) {
            console.error(
              "All JSON parsing attempts failed, creating fallback response",
              fixedJsonError
            );

            // Create fallback briefing with basic structure
            parsedBriefing = {
              summary: `Market summary for ${idea.name}`,
              details: allUrls.slice(0, 3).map((url: string, index: number) => {
                // Define emojis individually to avoid encoding issues
                const emoji1 = "📊";
                const emoji2 = "🔬";
                const emoji3 = "💡";

                // Use index to select emoji
                let selectedEmoji = emoji1;
                if (index % 3 === 1) selectedEmoji = emoji2;
                if (index % 3 === 2) selectedEmoji = emoji3;

                return {
                  summary: `Market signal related to ${idea.name}.`,
                  url: url,
                  emoji: selectedEmoji,
                  source_name: extractSourceNameFromUrl(url)
                };
              }),
              key_attributes: ideaSignals,
              suggested_signals: [
                `${idea.category || "industry"} market growth trends`,
                `${idea.category || "sector"} innovation developments`,
                `regulatory changes in ${idea.category || "this sector"}`,
                `investor interest in ${
                  idea.category || "similar technologies"
                }`,
                `competitive landscape analysis`,
              ],
            };
          }
        }
      }

      // Ensure the briefing has all required properties and valid URLs
      parsedBriefing.summary =
        parsedBriefing.summary || `Summary for ${idea.name}`;

      // Ensure details array exists and has valid URLs
      if (
        !Array.isArray(parsedBriefing.details) ||
        parsedBriefing.details.length === 0
      ) {
        parsedBriefing.details = allUrls
          .slice(0, 5)
          .map((url: string, index: number) => ({
            summary: `Market signal related to ${idea.name}.`,
            url: url,
            emoji: ["📊", "🔬", "🏭", "💡", "🌱"][index % 5],
            source_name: extractSourceNameFromUrl(url)
          }));
      } else {
        // Ensure each detail has a valid URL
        parsedBriefing.details = parsedBriefing.details.map(
          (detail: any, index: number) => {
            if (!detail.url || !detail.url.startsWith("http")) {
              // Replace invalid URL with one from our collection
              const validUrl =
                allUrls[index % allUrls.length] ||
                `https://example.com/${index}`;
              return {
                ...detail,
                url: validUrl,
                source_name: extractSourceNameFromUrl(validUrl)
              };
            }
            return detail;
          }
        );
      }

      // Fix malformed emojis in details
      parsedBriefing.details = ensureProperEmojis(parsedBriefing.details);

      // Always use the idea's existing key attributes instead of what the LLM suggests
      parsedBriefing.key_attributes = ideaSignals;

      parsedBriefing.suggested_signals = Array.isArray(
        parsedBriefing.suggested_signals
      )
        ? parsedBriefing.suggested_signals
        : [];

      // Ensure all details have source_name field
      if (Array.isArray(parsedBriefing.details)) {
        parsedBriefing.details = parsedBriefing.details.map((detail: any) => {
          if (!detail.source_name && detail.url) {
            return {
              ...detail,
              source_name: extractSourceNameFromUrl(detail.url)
            };
          }
          return detail;
        });
      }

      // Insert the briefing into the database
      const { data: insertedBriefing, error: insertError } = await supabase
        .from("briefings")
        .insert([
          {
            idea_id: ideaId,
            date_from: dateFrom,
            date_to: dateTo,
            summary: parsedBriefing.summary,
            details: parsedBriefing.details,
            key_attributes: parsedBriefing.key_attributes,
            suggested_signals: parsedBriefing.suggested_signals,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting briefing:", insertError);
        throw insertError;
      }

      console.log("Successfully inserted briefing");

      // Add detailed debugging for all parameters being received
      console.log("=== DETAILED REQUEST DEBUG ===");
      console.log("ideaId:", ideaId, "type:", typeof ideaId);
      console.log("ideaName:", ideaName, "type:", typeof ideaName);
      console.log(
        "rawIsAutomatic:",
        rawIsAutomatic,
        "type:",
        typeof rawIsAutomatic
      );
      console.log(
        "isAutomatic (parsed):",
        isAutomatic,
        "type:",
        typeof isAutomatic
      );
      console.log("isAutomatic === true:", isAutomatic === true);
      console.log("isAutomatic == true:", isAutomatic == true);
      console.log("Boolean(isAutomatic):", Boolean(isAutomatic));
      console.log("debugMode:", debugMode, "type:", typeof debugMode);
      console.log("=== END REQUEST DEBUG ===");

      // Only create notifications if isAutomatic is explicitly true (boolean)
      // This ensures notifications won't be created for manual generation
      const shouldCreateNotification = isAutomatic == true && idea.user_id;

      console.log("Should create notification:", shouldCreateNotification, {
        isAutomatic,
        isAutomaticValueType: typeof isAutomatic,
        isAutomaticDoubleEquals: isAutomatic == true,
        isAutomaticTripleEquals: isAutomatic === true,
        hasUserId: !!idea.user_id,
        userId: idea.user_id,
      });

      if (shouldCreateNotification) {
        try {
          console.log("=== NOTIFICATION DEBUGGING ===");
          console.log(
            "NOTIFICATION CREATION STARTED - THIS SHOULD BE VISIBLE IN LOGS"
          );
          console.log("Idea user_id:", idea.user_id);
          console.log("Creating notification with simplified approach");

          // Create simplified notification data - avoid foreign key issues
          const notificationData = {
            user_id: idea.user_id,
            title: `New Briefing for ${idea.name}`,
            content: `A new briefing has been generated for your idea: ${idea.name}`,
            // Don't include idea_id and briefing_id to avoid foreign key issues
            notification_type: "briefing",
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log(
            "Simplified notification data to insert:",
            notificationData
          );

          // Insert the notification
          const result = await supabase
            .from("notifications")
            .insert(notificationData)
            .select();

          // Check for errors
          if (result.error) {
            console.error(
              "Error inserting simplified notification:",
              result.error
            );
            console.log("ERROR DETAILS:", {
              message: result.error.message,
              code: result.error.code,
              details: result.error.details,
              hint: result.error.hint,
            });
            console.log("Failed to create notification");
          } else {
            console.log("Notification created successfully:", result.data);
          }

          // Verify if any notifications exist for this user
          const { data: existingNotifs, error: checkError } = await supabase
            .from("notifications")
            .select("id, title, created_at")
            .eq("user_id", idea.user_id)
            .order("created_at", { ascending: false })
            .limit(5);

          console.log("Recent notifications for user:", existingNotifs);
          if (checkError) {
            console.error("Error checking notifications:", checkError);
          }

          console.log("=== END NOTIFICATION DEBUGGING ===");
        } catch (error) {
          console.error("Error in notification creation:", error);

          // Extract more detailed error information
          const errorDetails = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            toString: String(error),
          };

          console.error("Detailed error info:", errorDetails);
        }
      } else {
        console.log("No user_id found for idea, skipping notification");
      }

      return NextResponse.json(insertedBriefing);
    } catch (error: any) {
      console.error(
        "Error generating briefing with llama-3.3-70b-versatile:",
        error
      );

      // Implement a fallback generation with a larger context model
      console.log("Attempting fallback with larger context model...");

      // Create a simplified prompt for the fallback model
      const fallbackPrompt = createFallbackPrompt(idea, effectiveDescription);

      try {
        // Try with a fallback model that has larger context window
        const fallbackCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are an expert at generating valid JSON output for business briefings. Ensure you create an impactful briefing that follows the guidelines exactly. Your entire response must be valid JSON with proper formatting.",
            },
            {
              role: "user",
              content: fallbackPrompt,
            },
          ],
          model: "llama3-70b-8192", // Larger context model
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });

        let fallbackContent = fallbackCompletion.choices[0]?.message?.content;
        if (!fallbackContent) {
          throw new Error("No content received from fallback");
        }

        // Try multiple parsing approaches
        let parsedFallback;
        try {
          parsedFallback = JSON.parse(fallbackContent);
        } catch (jsonError) {
          try {
            parsedFallback = JSON5.parse(fallbackContent);
          } catch (json5Error) {
            // Ultimate fallback - create our own minimal structure
            parsedFallback = {
              summary: `Market summary for ${idea.name}`,
              details: allUrls.slice(0, 3).map((url: string, index: number) => {
                // Define emojis individually to avoid encoding issues
                const emoji1 = "📊";
                const emoji2 = "🔬";
                const emoji3 = "💡";

                // Use index to select emoji
                let selectedEmoji = emoji1;
                if (index % 3 === 1) selectedEmoji = emoji2;
                if (index % 3 === 2) selectedEmoji = emoji3;

                return {
                  summary: `Market signal related to ${idea.name}.`,
                  url: url,
                  emoji: selectedEmoji,
                  source_name: extractSourceNameFromUrl(url)
                };
              }),
              key_attributes: ideaSignals,
              suggested_signals: [
                `${idea.category || "industry"} market growth trends`,
                `${idea.category || "sector"} innovation developments`,
                `regulatory changes in ${idea.category || "this sector"}`,
                `investor interest in ${
                  idea.category || "similar technologies"
                }`,
                `competitive landscape analysis`,
              ],
            };
          }
        }

        // Fix malformed emojis in fallback details
        parsedFallback.details = ensureProperEmojis(parsedFallback.details);

        // Always use the idea's existing key attributes for consistency
        parsedFallback.key_attributes = ideaSignals;

        // Ensure all details have source_name field
        if (Array.isArray(parsedFallback.details)) {
          parsedFallback.details = parsedFallback.details.map((detail: any) => {
            if (!detail.source_name && detail.url) {
              return {
                ...detail,
                source_name: extractSourceNameFromUrl(detail.url)
              };
            }
            return detail;
          });
        }

        // Insert the fallback briefing
        const { data: insertedFallback, error: fallbackError } = await supabase
          .from("briefings")
          .insert([
            {
              idea_id: ideaId,
              date_from: dateFrom,
              date_to: dateTo,
              summary: parsedFallback.summary,
              details: parsedFallback.details,
              key_attributes: parsedFallback.key_attributes,
              suggested_signals: parsedFallback.suggested_signals,
            },
          ])
          .select()
          .single();

        if (fallbackError) {
          console.error("Error inserting fallback briefing:", fallbackError);
          throw fallbackError;
        }

        console.log("Successfully inserted fallback briefing");
        return NextResponse.json(insertedFallback);
      } catch (fallbackError) {
        console.error("Fallback generation failed:", fallbackError);
        return NextResponse.json(
          { error: "Failed to generate briefing due to technical issues." },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error("Unhandled error in generate-briefing:", error);

    // Before returning error, try a direct notification test anyway
    try {
      // Get the userId from the request if we can
      let userId = null;
      let ideaName = "Unknown Idea";

      try {
        // Try to get from request data
        const requestData = await request.json().catch(() => ({}));
        userId = requestData?.user_id;
        ideaName = requestData?.ideaName || "Unknown Idea";
      } catch (parseError) {
        console.log("Could not parse request in error handler:", parseError);
      }

      if (userId) {
        console.log("Creating DIRECT TEST notification for user_id:", userId);

        const supabase = getServerSupabase();
        const directTestResult = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "DIRECT TEST from generate-briefing error handler",
            content: `Direct notification test at ${new Date().toISOString()}`,
            notification_type: "test",
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();

        if (directTestResult.error) {
          console.error(
            "DIRECT TEST notification failed:",
            directTestResult.error
          );
        } else {
          console.log(
            "DIRECT TEST notification succeeded:",
            directTestResult.data
          );
        }
      } else {
        console.log("Cannot create direct test - no user_id available");
      }
    } catch (notifError) {
      console.error("Error in direct notification test:", notifError);
    }

    return NextResponse.json(
      { error: error.message || "Unknown error occurred" },
      { status: 500 }
    );
  }
}
