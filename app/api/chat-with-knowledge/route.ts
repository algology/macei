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

    // Fetch data from the database
    const [
      { data: briefings },
      { data: organizationData },
      { data: missionData },
    ] = await Promise.all([
      supabase
        .from("briefings")
        .select("*")
        .eq("idea_id", ideaDetails.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("organizations")
        .select("industry, target_market, description")
        .eq("id", ideaDetails.mission?.organization?.id)
        .single(),
      supabase
        .from("missions")
        .select("motivation, success_criteria")
        .eq("id", ideaDetails.mission_id)
        .single(),
    ]);

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

KNOWLEDGE BASE DOCUMENTS AND MARKET SIGNALS:
${documents}

RECENT BRIEFINGS:
${briefings ? JSON.stringify(briefings) : "No briefings available"}

User Question: ${message}

Please provide a helpful, accurate response based on the available information. If you're unsure or if the information isn't available in the provided context, please say so. When analyzing market signals, consider:
1. The distribution of signal types and their impact levels
2. Recent trends in signal sentiment and frequency
3. The time range of available signals and their freshness
4. The relationship between different signal categories
5. Any notable patterns or anomalies in the data
6. The specific content and insights from saved signals`;

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

    return Response.json({
      content: completion.choices[0]?.message?.content || "",
    });
  } catch (error) {
    console.error("Error in knowledge base chat:", error);
    return Response.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
