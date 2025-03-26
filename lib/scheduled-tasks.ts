import cron from "node-cron";
import { getServerSupabase } from "./supabase";

// Function to initialize cron jobs
export function initScheduledTasks() {
  // Weekly briefing generation - runs every Sunday at 1:00 AM
  const weeklyBriefingJob = cron.schedule("0 1 * * 0", async () => {
    console.log(
      "Running weekly briefing generation job:",
      new Date().toISOString()
    );
    await generateAllIdeaBriefings();
  });

  return {
    weeklyBriefingJob,
  };
}

// Function to generate briefings for all active ideas
export async function generateAllIdeaBriefings(userId?: string) {
  try {
    const supabase = getServerSupabase();

    // Get all active ideas with their names, ordered by last briefing date
    // Only include ideas where auto_briefing_enabled is true or null (default)
    let query = supabase
      .from("ideas")
      .select(
        `
        id, 
        name,
        user_id,
        auto_briefing_enabled,
        last_briefing:briefings(date_to)
      `
      )
      .or("auto_briefing_enabled.is.null,auto_briefing_enabled.eq.true")
      .order("id", { ascending: true });

    // Filter by userId if provided (useful for testing)
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: ideas, error } = await query;

    if (error) {
      console.error("Error fetching ideas for weekly briefing:", error);
      return;
    }

    if (!ideas || ideas.length === 0) {
      console.log("No ideas found for weekly briefing generation");
      return;
    }

    console.log(`Processing ${ideas.length} ideas for briefing generation`);

    // Filter ideas with user_id to ensure notifications can be sent
    const ideasWithUser = ideas.filter((idea) => !!idea.user_id);
    if (ideasWithUser.length < ideas.length) {
      console.log(
        `${
          ideas.length - ideasWithUser.length
        } ideas skipped due to missing user_id`
      );
    }

    // Process each idea sequentially to avoid overwhelming the server
    for (const idea of ideasWithUser) {
      try {
        // Make a request to the generate-briefing API
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          }/api/generate-briefing`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ideaId: idea.id,
              ideaName: idea.name,
              isAutomatic: true, // This flag indicates it's an automated generation
              debugMode: false, // Disable debug mode in production
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            error.error || `Failed to generate briefing for idea ${idea.id}`
          );
        }

        // Create a notification directly to ensure it gets created
        const notificationData = {
          user_id: idea.user_id,
          title: `New Briefing for ${idea.name}`,
          content: `A new briefing has been generated for your idea: ${idea.name}`,
          notification_type: "briefing",
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: notifError } = await supabase
          .from("notifications")
          .insert(notificationData);

        if (notifError) {
          console.error(
            `Error creating notification for idea ${idea.id}:`,
            notifError
          );
        }

        // Add a delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Error generating briefing for idea ${idea.id}:`, error);
        // Continue with the next idea even if this one fails
      }
    }

    console.log("Weekly briefing generation job completed");
  } catch (error) {
    console.error("Error in generateAllIdeaBriefings:", error);
  }
}
