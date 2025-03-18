import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Get the auth token from the request headers
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Unauthorized - missing or invalid token" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];

    // Create a new supabase client with the user's token
    const supabaseWithAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const body = await request.json();
    const { signal, ideaId } = body;

    if (!signal || !ideaId) {
      return Response.json(
        { error: "Signal and ideaId are required" },
        { status: 400 }
      );
    }

    // Check for duplicates based on URL and idea_id
    const { data: existing } = await supabaseWithAuth
      .from("knowledge_base")
      .select("id")
      .eq("idea_id", ideaId)
      .eq("source_url", signal.url)
      .single();

    if (existing) {
      return Response.json(
        { error: "This source is already in the knowledge base" },
        { status: 409 }
      );
    }

    // Calculate a basic relevance score based on recency
    let relevanceScore = 70; // Base score
    if (signal.date && signal.date !== "N/A") {
      const pubDate = new Date(signal.date);
      const now = new Date();
      const monthsOld =
        (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      // Reduce score by 5 points for each month old, but don't go below 30
      relevanceScore = Math.max(30, relevanceScore - monthsOld * 5);
    }

    // Get idea details to provide context for AI analysis
    const { data: ideaDetails, error: ideaError } = await supabaseWithAuth
      .from("ideas")
      .select("name, category, signals, ai_analysis, mission_id, insights")
      .eq("id", ideaId)
      .single();

    if (ideaError) throw ideaError;

    // Get mission name for additional context
    const { data: missionData, error: missionError } = await supabaseWithAuth
      .from("missions")
      .select("name, organization_id")
      .eq("id", ideaDetails.mission_id)
      .single();

    if (missionError) throw missionError;

    // Get organization name for even more context
    const { data: organizationData, error: orgError } = await supabaseWithAuth
      .from("organizations")
      .select("name")
      .eq("id", missionData.organization_id)
      .single();

    if (orgError) throw orgError;

    // Save to knowledge base
    const { data, error } = await supabaseWithAuth
      .from("knowledge_base")
      .insert([
        {
          idea_id: ideaId,
          title: signal.title,
          content: signal.description,
          source_url: signal.url,
          source_type: signal.type,
          source_name: signal.source,
          publication_date: signal.date !== "N/A" ? signal.date : null,
          relevance_score: Math.round(relevanceScore),
          metadata: {
            ...(signal.patentNumber && { patent_number: signal.patentNumber }),
            ...(signal.status && { patent_status: signal.status }),
            ...(signal.inventor && { inventor: signal.inventor }),
          },
          last_analyzed: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Get all existing knowledge base documents for this idea
    const { data: knowledgeBase, error: kbError } = await supabaseWithAuth
      .from("knowledge_base")
      .select(
        "title, content, source_type, source_name, publication_date, metadata"
      )
      .eq("idea_id", ideaId);

    if (kbError) throw kbError;

    // Generate insights using Groq/Gemma
    const insightsPrompt = `
    I need to generate business insights based on a new piece of market intelligence that has been saved to a knowledge base.
    
    BUSINESS IDEA DETAILS:
    Idea Name: ${ideaDetails.name}
    Category: ${ideaDetails.category}
    Organization: ${organizationData.name}
    Mission: ${missionData.name}
    Market Signals: ${ideaDetails.signals || ""}
    
    EXISTING INSIGHTS:
    ${
      ideaDetails.insights
        ? JSON.stringify(ideaDetails.insights)
        : "No existing insights"
    }
    
    NEW KNOWLEDGE BASE ITEM:
    Title: ${signal.title}
    Content: ${signal.description}
    Source: ${signal.source}
    Type: ${signal.type}
    Date: ${signal.date !== "N/A" ? signal.date : "Not available"}
    ${signal.patentNumber ? `Patent Number: ${signal.patentNumber}` : ""}
    ${signal.status ? `Patent Status: ${signal.status}` : ""}
    
    KNOWLEDGE BASE CONTEXT (${knowledgeBase.length} items):
    ${JSON.stringify(knowledgeBase.slice(0, 5))}
    
    Based on this new information and the existing context, please generate:
    1. 2-3 key insights that this new information provides about the business idea
    2. How this impacts the idea's potential or challenges
    3. Any recommendations or actions to consider
    
    Format your response as a JSON array of insight objects:
    [
      {
        "insight": "One sentence insight statement",
        "impact": "Brief description of how this affects the business idea",
        "source": "The source of this insight (usually the title of the document)",
        "date_added": "${new Date().toISOString()}"
      },
      ...
    ]
    
    Limit to 2-3 high-quality insights that are directly relevant to the business idea.`;

    // Call Groq to generate insights
    const insightsResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: insightsPrompt,
        },
      ],
      model: "gemma2-9b-it",
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    let newInsights = [];
    try {
      const parsedContent =
        insightsResponse.choices[0]?.message?.content || "[]";
      const parsed = JSON.parse(parsedContent);
      // Ensure newInsights is always an array
      newInsights = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error parsing insights:", e);
      newInsights = [];
    }

    // Combine existing insights with new ones
    const existingInsights = Array.isArray(ideaDetails.insights)
      ? ideaDetails.insights
      : [];
    const combinedInsights = [...existingInsights, ...newInsights];

    // Update the idea with new insights
    const { data: updatedIdea, error: updateError } = await supabaseWithAuth
      .from("ideas")
      .update({
        insights: combinedInsights,
        last_analyzed: new Date().toISOString(),
      })
      .eq("id", ideaId);

    if (updateError) {
      console.error("Error updating insights:", updateError);
    }

    return Response.json({
      success: true,
      document: data,
      insights: combinedInsights,
    });
  } catch (error) {
    console.error("Error saving to knowledge base:", error);
    return Response.json(
      { error: "Failed to save to knowledge base" },
      { status: 500 }
    );
  }
}
