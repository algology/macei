import Groq from "groq-sdk";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

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

    // Get user information from the token
    const {
      data: { user },
      error: userError,
    } = await supabaseWithAuth.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user from token:", userError);
      return Response.json(
        { error: "Unauthorized - invalid token" },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log("Processing knowledge base query for user:", userId);

    const body = await request.json();
    const { message } = body;

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Get all ideas the user has access to through multiple paths
    let userIdeaIds: number[] = [];

    // Approach 1: Get ideas directly owned by the user
    const { data: directIdeas, error: directIdeasError } =
      await supabaseWithAuth.from("ideas").select("id").eq("user_id", userId);

    if (directIdeasError) {
      console.error("Error fetching direct ideas:", directIdeasError);
    } else {
      console.log("Direct ideas found:", directIdeas?.length || 0);
      if (directIdeas && directIdeas.length > 0) {
        userIdeaIds = [...userIdeaIds, ...directIdeas.map((idea) => idea.id)];
      }
    }

    // Approach 2: Get ideas through organization ownership
    const { data: userOrgs, error: userOrgsError } = await supabaseWithAuth
      .from("organizations")
      .select("id")
      .eq("user_id", userId);

    if (userOrgsError) {
      console.error("Error fetching user organizations:", userOrgsError);
    } else if (userOrgs && userOrgs.length > 0) {
      const orgIds = userOrgs.map((org) => org.id);

      // Get ideas through missions in these organizations
      const { data: orgMissions, error: orgMissionsError } =
        await supabaseWithAuth
          .from("missions")
          .select("id")
          .in("organization_id", orgIds);

      if (orgMissionsError) {
        console.error("Error fetching org missions:", orgMissionsError);
      } else if (orgMissions && orgMissions.length > 0) {
        const missionIds = orgMissions.map((mission) => mission.id);

        // Get ideas in these missions
        const { data: missionIdeas, error: missionIdeasError } =
          await supabaseWithAuth
            .from("ideas")
            .select("id")
            .in("mission_id", missionIds);

        if (missionIdeasError) {
          console.error("Error fetching mission ideas:", missionIdeasError);
        } else if (missionIdeas && missionIdeas.length > 0) {
          userIdeaIds = [
            ...userIdeaIds,
            ...missionIdeas.map((idea) => idea.id),
          ];
        }
      }
    }

    // Approach 3: Get ideas through mission ownership
    const { data: userMissions, error: userMissionsError } =
      await supabaseWithAuth
        .from("missions")
        .select("id")
        .eq("user_id", userId);

    if (userMissionsError) {
      console.error("Error fetching user missions:", userMissionsError);
    } else if (userMissions && userMissions.length > 0) {
      const missionIds = userMissions.map((mission) => mission.id);

      // Get ideas in these missions
      const { data: missionIdeas, error: missionIdeasError } =
        await supabaseWithAuth
          .from("ideas")
          .select("id")
          .in("mission_id", missionIds);

      if (missionIdeasError) {
        console.error("Error fetching mission ideas:", missionIdeasError);
      } else if (missionIdeas && missionIdeas.length > 0) {
        userIdeaIds = [...userIdeaIds, ...missionIdeas.map((idea) => idea.id)];
      }
    }

    // Approach 4: Get ideas through mission contributions
    const { data: contributedMissions, error: contributedMissionsError } =
      await supabaseWithAuth
        .from("mission_contributors")
        .select("mission_id")
        .eq("user_id", userId);

    if (contributedMissionsError) {
      console.error(
        "Error fetching contributed missions:",
        contributedMissionsError
      );
    } else if (contributedMissions && contributedMissions.length > 0) {
      const missionIds = contributedMissions.map((cm) => cm.mission_id);

      // Get ideas in these missions
      const { data: missionIdeas, error: missionIdeasError } =
        await supabaseWithAuth
          .from("ideas")
          .select("id")
          .in("mission_id", missionIds);

      if (missionIdeasError) {
        console.error("Error fetching mission ideas:", missionIdeasError);
      } else if (missionIdeas && missionIdeas.length > 0) {
        userIdeaIds = [...userIdeaIds, ...missionIdeas.map((idea) => idea.id)];
      }
    }

    // Remove duplicates
    const uniqueIdeaIds = [...new Set(userIdeaIds)];
    console.log(
      "Total unique idea IDs for knowledge base:",
      uniqueIdeaIds.length
    );

    if (uniqueIdeaIds.length === 0) {
      return Response.json({
        content:
          "I don't have any knowledge base data to analyze yet. Try creating some ideas and adding knowledge to them first.",
      });
    }

    // Fetch knowledge base entries from the user's ideas
    const { data: knowledgeBaseData, error: knowledgeBaseError } =
      await supabaseWithAuth
        .from("knowledge_base")
        .select(
          `
        id,
        title,
        content,
        source_url,
        source_type,
        source_name,
        publication_date,
        idea_id,
        metadata,
        idea:ideas (
          name,
          category,
          mission_id,
          mission:missions (
            name,
            organization_id,
            organization:organizations (
              name,
              industry,
              target_market
            )
          )
        )
      `
        )
        .in("idea_id", uniqueIdeaIds)
        .order("created_at", { ascending: false })
        .limit(50);

    if (knowledgeBaseError) {
      console.error("Error fetching knowledge base data:", knowledgeBaseError);
      return Response.json(
        { error: "Failed to fetch knowledge base data" },
        { status: 500 }
      );
    }

    console.log(
      "Knowledge base entries found:",
      knowledgeBaseData?.length || 0
    );

    // Fetch briefings for the user's ideas
    const { data: briefingsData, error: briefingsError } =
      await supabaseWithAuth
        .from("briefings")
        .select(
          `
        id,
        summary,
        details,
        key_attributes,
        next_steps,
        created_at,
        idea_id,
        idea:ideas (
          name,
          category,
          mission_id,
          mission:missions (
            name,
            organization_id,
            organization:organizations (
              name
            )
          )
        )
      `
        )
        .in("idea_id", uniqueIdeaIds)
        .order("created_at", { ascending: false })
        .limit(10);

    if (briefingsError) {
      console.error("Error fetching briefings data:", briefingsError);
      return Response.json(
        { error: "Failed to fetch briefings data" },
        { status: 500 }
      );
    }

    console.log("Briefings found:", briefingsData?.length || 0);

    // Structure knowledge base by idea/mission/organization
    const structuredData = knowledgeBaseData.reduce((acc: any, item: any) => {
      const orgName = item.idea?.mission?.organization?.name;
      const missionName = item.idea?.mission?.name;
      const ideaName = item.idea?.name;

      if (!orgName || !missionName || !ideaName) return acc;

      if (!acc[orgName]) acc[orgName] = {};
      if (!acc[orgName][missionName]) acc[orgName][missionName] = {};
      if (!acc[orgName][missionName][ideaName])
        acc[orgName][missionName][ideaName] = [];

      acc[orgName][missionName][ideaName].push({
        title: item.title,
        content: item.content,
        source: item.source_name,
        type: item.source_type,
        date: item.publication_date,
        url: item.source_url,
      });

      return acc;
    }, {});

    const prompt = `You are an AI assistant with access to a knowledge base containing information about various business ideas, missions, and organizations. This is a chat interface where users can ask questions about the knowledge across all ideas.

KNOWLEDGE BASE OVERVIEW:
${JSON.stringify(structuredData, null, 2).substring(0, 10000)}

RECENT BRIEFINGS:
${JSON.stringify(briefingsData.slice(0, 5), null, 2).substring(0, 5000)}

User Question: ${message}

Please provide a helpful, accurate response based on the available knowledge. If you're unsure or if the information isn't available in the provided context, please say so.

When analyzing the information, consider:
1. The relationships between organizations, missions, and ideas
2. Common themes or patterns across different ideas
3. The distribution of information sources and their credibility
4. Recent trends or developments reflected in the knowledge base
5. Insights that span across multiple ideas or missions
6. Any notable gaps in the knowledge that might need addressing`;

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
      content:
        completion.choices[0]?.message?.content ||
        "I couldn't generate a response. Please try again.",
    });
  } catch (error) {
    console.error("Error in global knowledge base chat:", error);
    return Response.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
