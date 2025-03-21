import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Get request data
    const { ideaId, ideaName } = await request.json();
    console.log("Received request for idea:", ideaId);

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

    // Download and parse document contents
    const documentContents = await Promise.all(
      (documents || []).map(async (doc) => {
        try {
          // Extract the file path from the URL
          const filePath = doc.url.split("idea-documents/")[1];
          console.log("Processing document:", doc.name, filePath);

          // Download the file using Supabase storage
          const { data, error } = await supabase.storage
            .from("idea-documents")
            .download(filePath);

          if (error) {
            console.error("Error downloading document:", doc.name, error);
            throw error;
          }

          // Convert the blob to text
          const text = await data.text();
          return {
            name: doc.name,
            type: doc.url.split(".").pop(),
            content: text,
          };
        } catch (error) {
          console.error("Error processing document:", doc.name, error);
          return {
            name: doc.name,
            type: doc.url.split(".").pop(),
            content: "Failed to load document content",
          };
        }
      })
    );

    // Prepare document context string
    const documentContext =
      documentContents.length > 0
        ? documentContents
            .map(
              (doc) =>
                `Document: ${doc.name}\nType: ${doc.type}\nContent:\n${doc.content}\n---`
            )
            .join("\n\n")
        : "No documents available";

    console.log("Prepared document context");

    // Prepare the prompt for the LLM
    const prompt = `You are an expert analyst tasked with generating an idea Environment Briefing Note. The briefing should follow this structure:

1. Impact on Idea Conviction
- Provide a devil's advocate analysis of how recent developments might challenge the idea's objectives
- Use unique examples and data to build a persuasive argument
- If no material impact is found, state this clearly

2. Summary
- Summarize the most important insights in 5-6 sentences
- Highlight novel and significant points (major announcements, quantitative data, innovations)
- Avoid repeating insights that appear in the Details section

3. Details
- For each relevant development, provide:
  - A 1-2 sentence summary focused on key novel insights
  - A URL to the source
  - A country flag emoji indicating the primary nation

4. Key Attributes
- List new idea-related attributes, technologies, or concepts identified
- Use concise terms

Please analyze the following idea and generate a briefing note:

Idea Name: ${idea.name}
Description: ${idea.description || "Not provided"}
Summary: ${idea.summary || "Not provided"}
Category: ${idea.category || "Not provided"}
Mission: ${idea.mission?.name || "Not provided"}
Mission Description: ${idea.mission?.description || "Not provided"}
Organization: ${idea.mission?.organization?.name || "Not provided"}
Industry: ${idea.mission?.organization?.industry || "Not provided"}

Knowledge Base Documents:
${documentContext}

The briefing should cover the period from ${new Date(
      dateFrom
    ).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}.

Format your response as a JSON object with the following structure:
{
  "impact_analysis": "string",
  "summary": "string",
  "details": [
    {
      "summary": "string",
      "url": "string",
      "country": "string (emoji)"
    }
  ],
  "key_attributes": ["string"]
}

Important: Your response must be valid JSON.`;

    console.log("Calling Groq API...");

    // Call the LLM
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gemma2-9b-it",
      temperature: 0.7,
      max_tokens: 4096,
    });

    console.log("Received response from Groq");

    let briefingContent = completion.choices[0]?.message?.content;
    if (!briefingContent) {
      throw new Error("No content received from Groq");
    }

    console.log("Raw response:", briefingContent);

    // Try to extract JSON if wrapped in markdown
    if (briefingContent.includes("```json")) {
      const jsonMatch = briefingContent.match(/```json\n([\s\S]*?)\n```/);
      briefingContent = jsonMatch ? jsonMatch[1] : briefingContent;
    }

    let parsedBriefing;
    try {
      parsedBriefing = JSON.parse(briefingContent);
    } catch (error) {
      console.error("JSON parsing error:", error);
      console.error("Content that failed to parse:", briefingContent);
      throw new Error("Failed to parse LLM response as JSON");
    }

    // Validate the parsed briefing has the required structure
    if (
      !parsedBriefing.impact_analysis ||
      !parsedBriefing.summary ||
      !Array.isArray(parsedBriefing.details) ||
      !Array.isArray(parsedBriefing.key_attributes)
    ) {
      console.error("Invalid briefing structure:", parsedBriefing);
      throw new Error("LLM response missing required fields");
    }

    console.log("Successfully parsed briefing");

    // Parse the signals from the idea
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

    // Insert the briefing into the database
    const { data: insertedBriefing, error: insertError } = await supabase
      .from("briefings")
      .insert([
        {
          idea_id: ideaId,
          date_from: dateFrom,
          date_to: dateTo,
          impact_analysis: parsedBriefing.impact_analysis,
          summary: parsedBriefing.summary,
          details: parsedBriefing.details,
          key_attributes: ideaSignals, // Use the idea's signals instead of generated key_attributes
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting briefing:", insertError);
      throw insertError;
    }

    console.log("Successfully inserted briefing");

    return NextResponse.json({ briefing: insertedBriefing });
  } catch (error) {
    console.error("Error in generate-briefing:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate briefing",
      },
      { status: 500 }
    );
  }
}
