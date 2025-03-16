import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signal, ideaId } = body;

    if (!signal || !ideaId) {
      return Response.json(
        { error: "Signal and ideaId are required" },
        { status: 400 }
      );
    }

    // Check for duplicates based on URL and idea_id
    const { data: existing } = await supabase
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

    // Save to knowledge base
    const { data, error } = await supabase
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

    // Fetch the updated idea insights to return
    const { data: insights, error: insightsError } = await supabase
      .from("idea_insights")
      .select("*")
      .eq("idea_id", ideaId)
      .single();

    if (insightsError) throw insightsError;

    return Response.json({
      success: true,
      document: data,
      insights,
    });
  } catch (error) {
    console.error("Error saving to knowledge base:", error);
    return Response.json(
      { error: "Failed to save to knowledge base" },
      { status: 500 }
    );
  }
}
