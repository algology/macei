import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

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

    // Fetch the updated idea insights
    const { data: ideaData, error: ideaError } = await supabaseWithAuth
      .from("ideas")
      .select("insights")
      .eq("id", ideaId)
      .single();

    if (ideaError) throw ideaError;

    return Response.json({
      success: true,
      document: data,
      insights: ideaData?.insights || [],
    });
  } catch (error) {
    console.error("Error saving to knowledge base:", error);
    return Response.json(
      { error: "Failed to save to knowledge base" },
      { status: 500 }
    );
  }
}
