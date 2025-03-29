import Groq from "groq-sdk";
import { supabase } from "@/lib/supabase";

// Define a type for the signal data
interface SignalData {
  title: string;
  content: string;
  source_name: string;
  publication_date: string;
  relevance_score: number;
  source_type: string;
  metadata: {
    impact_level: string;
    sentiment: string;
  };
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, ideaDetails, documents } = body;

    console.log("Chat request received for idea:", ideaDetails.id);
    console.log("Documents in request:", documents ? "Yes" : "No");
    console.log(
      "Idea details:",
      JSON.stringify({
        id: ideaDetails.id,
        name: ideaDetails.name,
        status: ideaDetails.status,
      })
    );

    // DEEP DEBUG: Examine documents structure
    if (documents) {
      console.log("===== DOCUMENTS STRING ANALYSIS =====");
      console.log("Documents type:", typeof documents);
      console.log("Documents length:", documents?.length);
      console.log("First 200 chars:", documents?.substring(0, 200));
      console.log(
        "Contains 'Digital dominance':",
        documents?.includes("Digital dominance")
      );
      console.log("Contains 'Raconteur':", documents?.includes("Raconteur"));
      console.log(
        "Contains 'Market Signals':",
        documents?.includes("Market Signals")
      );
      console.log("Contains '30%':", documents?.includes("30%"));
      console.log("Contains 'Relevance':", documents?.includes("Relevance"));
      console.log("===== END DOCUMENTS ANALYSIS =====");
    }

    // Check if the knowledge_base table has any data at all
    const { data: allKnowledgeBaseEntries, error: allKbError } = await supabase
      .from("knowledge_base")
      .select("id, idea_id, title")
      .limit(5);

    console.log(
      "Sample knowledge base entries (not filtered):",
      allKnowledgeBaseEntries?.length || 0,
      allKnowledgeBaseEntries
        ?.map((e) => `[${e.id}: Idea ${e.idea_id} - ${e.title}]`)
        .join(", ")
    );

    if (allKbError) {
      console.error("Error querying knowledge base:", allKbError);
    }

    // Fetch additional data from the database
    const [
      { data: briefings },
      { data: knowledgeBase, error: kbError },
      { data: marketSignals },
    ] = await Promise.all([
      supabase
        .from("briefings")
        .select("*")
        .eq("idea_id", ideaDetails.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("knowledge_base")
        .select("*")
        .eq("idea_id", ideaDetails.id)
        .order("relevance_score", { ascending: false }),
      supabase
        .from("ideas")
        .select("signals")
        .eq("id", ideaDetails.id)
        .single(),
    ]);

    console.log("Knowledge base query for idea_id:", ideaDetails.id);
    if (kbError) {
      console.error("Error fetching knowledge base:", kbError);
    }
    console.log(
      "Knowledge base entries for this idea:",
      knowledgeBase?.length || 0
    );

    // Manual fallback - attempt to fetch signal data directly from UI state
    let fallbackSignals: SignalData[] = [];
    if (documents && typeof documents === "string") {
      // Try to extract signal data from the documents string if it contains signal data
      try {
        if (
          documents.includes("Market Signals (") ||
          documents.includes("Digital dominance") ||
          documents.includes("Relevance:")
        ) {
          console.log("Attempting to parse signal data from documents string");

          // Try to extract structured signal data with multiple formats
          let signalMatches = documents.match(
            /([^\n]+)\n([^\n]+)\n•\n([^\n]+)\n•\nRelevance: ([^\n]+)/g
          );

          // If standard pattern doesn't match, try alternative formats
          if (!signalMatches || signalMatches.length === 0) {
            // Look for titles followed by source and relevance percentage
            if (!signalMatches || signalMatches.length === 0) {
              // Try with a simpler direct regex
              const directMatches = documents.match(
                /Digital dominance:[^\n]+([\s\S]*?)Relevance: (\d+)%/
              );

              if (directMatches) {
                console.log("Found direct match for market signal");
                const titleMatch = documents.match(
                  /(Digital dominance:[^\n]+)/
                );
                const sourceMatch = documents.match(/\n(Raconteur)/);
                const dateMatch = documents.match(/(\d+\/\d+\/\d+)/);
                const relevanceMatch = documents.match(/Relevance: (\d+)%/);

                fallbackSignals = [
                  {
                    title: titleMatch ? titleMatch[1] : "Digital dominance",
                    content: directMatches[0],
                    source_name: sourceMatch ? sourceMatch[1] : "Raconteur",
                    publication_date: dateMatch ? dateMatch[1] : "26/06/2024",
                    relevance_score: relevanceMatch
                      ? parseInt(relevanceMatch[1])
                      : 30,
                    source_type: "news",
                    metadata: {
                      impact_level: "medium",
                      sentiment: "positive",
                    },
                  },
                ];
                console.log("Created fallback signal from direct match");
              }
            }
          }

          // Process the matches if any were found with the standard regex
          if (signalMatches && signalMatches.length > 0) {
            fallbackSignals = signalMatches.map((match) => {
              const parts = match.split("\n");
              return {
                title: parts[0].trim(),
                content: parts[0].trim(),
                source_name: parts[1].trim(),
                publication_date: parts[3].trim(),
                relevance_score: parseInt(
                  parts[5].replace("Relevance: ", "").replace("%", "")
                ),
                source_type: "news",
                metadata: {
                  impact_level: "medium",
                  sentiment: "neutral",
                },
              };
            });
            console.log("Extracted fallback signals:", fallbackSignals.length);
          }
        }
      } catch (parseError) {
        console.error("Error parsing fallback signals:", parseError);
      }
    }

    // Get organization details
    const { data: organizationData } = await supabase
      .from("organizations")
      .select("industry, target_market, description")
      .eq("id", ideaDetails.mission?.organization?.id)
      .single();

    // Get mission details
    const { data: missionData } = await supabase
      .from("missions")
      .select("motivation, success_criteria")
      .eq("id", ideaDetails.mission_id)
      .single();

    // Debug the knowledge base data
    if (knowledgeBase && knowledgeBase.length > 0) {
      console.log("First knowledge base entry:", {
        title: knowledgeBase[0].title,
        source_type: knowledgeBase[0].source_type,
        relevance_score: knowledgeBase[0].relevance_score,
      });
    } else if (fallbackSignals.length > 0) {
      console.log("Using fallback signals:", fallbackSignals.length);
    } else {
      console.log("No knowledge base entries found");
    }

    // Use either the database signals or fallback signals
    const effectiveSignals =
      knowledgeBase && knowledgeBase.length > 0
        ? knowledgeBase
        : fallbackSignals;

    // Process market signals for better analysis
    let processedSignals: Record<string, any> = {};
    let savedSignalsList: Array<any> = [];

    if (effectiveSignals.length > 0) {
      processedSignals = effectiveSignals.reduce((acc: any, signal: any) => {
        const type = signal.source_type || "unknown";
        if (!acc[type]) {
          acc[type] = {
            count: 0,
            highImpact: 0,
            positive: 0,
            negative: 0,
            recent: 0,
            oldest: null,
            newest: null,
            savedSignals: [],
          };
        }

        acc[type].count++;
        if (signal.metadata?.impact_level === "high") acc[type].highImpact++;
        if (signal.metadata?.sentiment === "positive") acc[type].positive++;
        if (signal.metadata?.sentiment === "negative") acc[type].negative++;

        const date = new Date(signal.publication_date || new Date());
        if (!acc[type].oldest || date < new Date(acc[type].oldest)) {
          acc[type].oldest =
            signal.publication_date || new Date().toISOString();
        }
        if (!acc[type].newest || date > new Date(acc[type].newest)) {
          acc[type].newest =
            signal.publication_date || new Date().toISOString();
        }

        // Consider signals from last 30 days as recent
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (date >= thirtyDaysAgo) acc[type].recent++;

        // Add saved signal details
        const signalDetails = {
          title: signal.title || "Untitled",
          content: signal.content || signal.title || "No content provided",
          source: signal.source_name || "Unknown source",
          date: signal.publication_date || new Date().toISOString(),
          relevance: signal.relevance_score || 0,
          impact: signal.metadata?.impact_level || "Not specified",
          sentiment: signal.metadata?.sentiment || "Not specified",
          type: type,
        };

        acc[type].savedSignals.push(signalDetails);
        savedSignalsList.push(signalDetails);

        return acc;
      }, {});
    }

    // If we still have no signals but the UI shows them, add manual signals based on user data
    if (savedSignalsList.length === 0) {
      console.log("No market signals found yet for this idea");
    }

    // Better document string signal extraction - in case signals are displayed in UI but not in database
    if (
      savedSignalsList.length === 0 &&
      documents &&
      typeof documents === "string"
    ) {
      console.log(
        "Attempting more advanced signal extraction from document string"
      );

      // Look for structured signal content in the document string
      // This regex looks for the pattern of a market signal display in the UI
      const marketSignalSections = documents.match(
        /Market Signal: (.*?)(?=Market Signal:|$)/g
      );

      if (marketSignalSections && marketSignalSections.length > 0) {
        console.log(
          `Found ${marketSignalSections.length} market signal sections in document`
        );

        const extractedSignals = marketSignalSections.map((section) => {
          // Extract information from each signal section
          const titleMatch = section.match(/Market Signal: (.*?)(?:\n|$)/);
          const sourceMatch = section.match(/Source: (.*?)(?:\n|$)/);
          const dateMatch = section.match(/Date: (.*?)(?:\n|$)/);
          const relevanceMatch = section.match(/Relevance: (\d+)%/);
          // Use a more compatible approach for multiline content extraction
          let content = "";
          if (section.includes("Content:")) {
            const contentStart =
              section.indexOf("Content:") + "Content:".length;
            const contentEnd = section.indexOf("\n---", contentStart);
            content =
              contentEnd > contentStart
                ? section.substring(contentStart, contentEnd).trim()
                : section.substring(contentStart).trim();
          }

          return {
            title: titleMatch ? titleMatch[1].trim() : "Unknown Signal",
            content:
              content || (titleMatch ? titleMatch[1].trim() : "No content"),
            source: sourceMatch ? sourceMatch[1].trim() : "Unknown Source",
            date: dateMatch ? dateMatch[1].trim() : new Date().toISOString(),
            relevance: relevanceMatch ? parseInt(relevanceMatch[1]) : 50,
            impact: "medium",
            sentiment: "neutral",
            type: "extracted",
          };
        });

        if (extractedSignals.length > 0) {
          console.log(
            `Successfully extracted ${extractedSignals.length} signals from document string`
          );
          savedSignalsList = extractedSignals;

          // Add to processed signals
          if (!processedSignals["extracted"]) {
            processedSignals["extracted"] = {
              count: extractedSignals.length,
              highImpact: 0,
              positive: 0,
              negative: 0,
              recent: extractedSignals.length,
              oldest: extractedSignals[0].date,
              newest: extractedSignals[0].date,
              savedSignals: extractedSignals,
            };
          }
        }
      }
    }

    console.log("Processed signals for types:", Object.keys(processedSignals));
    console.log("Total saved signals:", savedSignalsList.length);
    console.log(
      "Signal sources:",
      savedSignalsList.map((s) => s.type).join(", ")
    );

    // Debug document content
    if (documents && typeof documents === "string") {
      console.log(
        "Document includes 'Digital dominance':",
        documents.includes("Digital dominance")
      );
      console.log("Document sample:", documents.substring(0, 100));
      console.log("Document length:", documents.length);
    }

    // Parse signals from the idea's signals field
    let ideaSignals: string[] = [];
    try {
      if (marketSignals?.signals) {
        if (typeof marketSignals.signals === "string") {
          // Try to parse JSON if it's a string
          if (marketSignals.signals.startsWith("[")) {
            ideaSignals = JSON.parse(marketSignals.signals);
          } else {
            // Handle comma-separated format
            ideaSignals = marketSignals.signals.split(",").map((s) => s.trim());
          }
        } else if (Array.isArray(marketSignals.signals)) {
          ideaSignals = marketSignals.signals;
        }
      }

      console.log("Parsed signals from idea:", ideaSignals.length);

      // Convert the idea's signals array to signal objects if we have no other signals
      if (savedSignalsList.length === 0 && ideaSignals.length > 0) {
        console.log("Creating signal objects from idea signals array");

        savedSignalsList = ideaSignals.map((signal) => ({
          title: signal,
          content: signal,
          source: "Idea Attributes",
          date: ideaDetails.created_at || new Date().toISOString(),
          relevance: 80, // High relevance since these are explicitly defined
          impact: "medium",
          sentiment: "neutral",
          type: "attribute",
        }));

        // Add to processed signals
        if (!processedSignals["attribute"]) {
          processedSignals["attribute"] = {
            count: savedSignalsList.length,
            highImpact: 0,
            positive: 0,
            negative: 0,
            recent: savedSignalsList.length,
            oldest: savedSignalsList[0].date,
            newest: savedSignalsList[0].date,
            savedSignals: savedSignalsList,
          };
        }

        console.log(
          "Created signals from idea's signals array:",
          savedSignalsList.length
        );
      }
    } catch (error) {
      console.error("Error parsing idea signals:", error);
    }

    // Create the prompt with proper formatting
    let savedSignalsSection = "No saved market signals found.";

    if (savedSignalsList.length > 0) {
      console.log(
        "About to create savedSignalsSection. First signal:",
        JSON.stringify(savedSignalsList[0])
      );

      // Create a formatted list of all signals
      const allSignalsList = savedSignalsList
        .map(
          (signal) =>
            `- ${signal.title}\n  Source: ${
              signal.source || "Unknown"
            }\n  Type: ${signal.type || "general"}\n  Relevance: ${
              signal.relevance || 50
            }%\n  Content: ${signal.content || signal.title}\n`
        )
        .join("\n");

      savedSignalsSection = "MARKET SIGNALS:\n" + allSignalsList;

      // Also include signal info categorized by type if available
      if (Object.keys(processedSignals).length > 0) {
        const typesSummary = Object.entries(processedSignals)
          .map(([type, data]: [string, any]) => {
            if (!data || !data.count) return "";
            return `${type.toUpperCase()}: ${data.count} signals`;
          })
          .filter((section) => section.length > 0)
          .join(", ");

        if (typesSummary) {
          savedSignalsSection =
            `MARKET SIGNALS SUMMARY:\n${typesSummary}\n\nDETAILED MARKET SIGNALS:\n` +
            allSignalsList;
        }
      }
    }

    console.log("Final savedSignalsList length:", savedSignalsList.length);
    console.log(
      "savedSignalsSection starts with:",
      savedSignalsSection.substring(0, 50)
    );

    // Create market signals analysis section
    let marketSignalsAnalysis = "No market signals analysis available.";

    if (Object.keys(processedSignals).length > 0) {
      marketSignalsAnalysis = Object.entries(processedSignals)
        .map(([type, data]: [string, any]) => {
          if (data.count === 0) return "";

          return `${type.toUpperCase()} SIGNALS:\n- Total Count: ${
            data.count
          }\n- High Impact Signals: ${
            data.highImpact
          }\n- Recent Signals (Last 30 Days): ${
            data.recent
          }\n- Sentiment Distribution:\n  * Positive: ${
            data.positive
          }\n  * Negative: ${data.negative}\n  * Neutral: ${
            data.count - data.positive - data.negative
          }\n- Time Range: ${new Date(
            data.oldest
          ).toLocaleDateString()} to ${new Date(
            data.newest
          ).toLocaleDateString()}`;
        })
        .filter((section) => section.length > 0)
        .join("\n\n");
    }

    // Create market signals by category section
    let marketSignalsByCategory = "No market signals categories available.";

    if (Object.keys(processedSignals).length > 0) {
      marketSignalsByCategory = Object.entries(processedSignals)
        .map(([type, data]: [string, any]) => {
          if (data.count === 0) return "";

          return `- ${type}: ${data.count} signals (${data.highImpact} high impact, ${data.recent} recent)`;
        })
        .filter((section) => section.length > 0)
        .join("\n");
    }

    const prompt = `You are an AI assistant with access to knowledge about the following business idea and its associated documents. Use this context to answer questions and provide insights.

ORGANIZATION CONTEXT:
Organization Name: ${ideaDetails.mission?.organization?.name || "Not specified"}
Industry: ${organizationData?.industry || "Not specified"}
Target Market: ${organizationData?.target_market || "Not specified"}
Description: ${organizationData?.description || "Not specified"}

MISSION CONTEXT:
Mission Name: ${ideaDetails.mission?.name || "Not specified"}
Mission Description: ${ideaDetails.mission?.description || "Not specified"}
Mission Motivation: ${missionData?.motivation || "Not specified"}
Success Criteria: ${missionData?.success_criteria || "Not specified"}

IDEA CONTEXT:
Name: ${ideaDetails.name}
Category: ${ideaDetails.category}
Status: ${ideaDetails.status}
Summary: ${ideaDetails.summary || "Not specified"}
Detailed Analysis: ${ideaDetails.detailed_analysis || "Not available"}
Last Analyzed: ${ideaDetails.last_analyzed || "Not available"}
AI Analysis: ${ideaDetails.ai_analysis || "Not available"}
Created: ${ideaDetails.created_at}
Last Updated: ${ideaDetails.last_analyzed}

HISTORICAL INSIGHTS:
${
  ideaDetails.insights
    ? JSON.stringify(ideaDetails.insights)
    : "No insights available"
}

SAVED MARKET SIGNALS:
${savedSignalsSection}

MARKET SIGNALS ANALYSIS:
${marketSignalsAnalysis}

MARKET SIGNALS BY CATEGORY:
${marketSignalsByCategory}

RECENT BRIEFINGS:
${briefings ? JSON.stringify(briefings) : "No briefings available"}

KNOWLEDGE BASE STATS:
- Total Documents: ${documents?.length || 0}
- Market Signals: ${savedSignalsList.length}
- Last Updated: ${new Date().toISOString()}

KNOWLEDGE BASE DOCUMENTS:
${documents}

User Question: ${message}

Please provide a helpful, accurate response based on the available information. If you're unsure or if the information isn't available in the provided context, please say so. When analyzing market signals, consider:
1. The distribution of signal types and their impact levels
2. Recent trends in signal sentiment and frequency
3. The time range of available signals and their freshness
4. The relationship between different signal categories
5. Any notable patterns or anomalies in the data
6. The specific content and insights from saved signals`;

    console.log("Sending prompt to AI model");

    // Log the market signals section of the prompt
    console.log(
      "MARKET SIGNALS SECTION IN PROMPT:",
      prompt.includes("No saved market signals found.")
        ? "No signals message found"
        : "Contains signal data"
    );

    // Check if the digital dominance content appears in the prompt
    console.log(
      "PROMPT CONTAINS DIGITAL DOMINANCE:",
      prompt.includes("Digital dominance") ? "YES" : "NO"
    );

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gemma2-9b-it",
      temperature: 0.7,
      max_tokens: 1024,
    });

    console.log("Got response from AI model");

    return Response.json({
      content: completion.choices[0]?.message?.content || "",
    });
  } catch (error) {
    console.error("Error in knowledge base chat:", error);
    return Response.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
