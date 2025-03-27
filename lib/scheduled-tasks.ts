import cron from "node-cron";
import { getServerSupabase } from "./supabase";
import { sendEmail, generateBriefingEmail } from "./emailService";

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
    const processedIdeas: Array<{
      id: number;
      name: string;
      userId: string;
      briefingId: number;
      briefingSummary: string;
    }> = [];
    const errors: Array<{ ideaId: number; ideaName: string; error: string }> =
      [];

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

        // Get the response data to extract the briefing information
        const briefingData = await response.json();

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

        // Track successfully processed ideas with briefing details
        processedIdeas.push({
          id: idea.id,
          name: idea.name,
          userId: idea.user_id,
          briefingId: briefingData.id,
          briefingSummary:
            briefingData.summary || "Weekly market intelligence update",
        });

        // Add a delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Error generating briefing for idea ${idea.id}:`, error);
        // Track errors
        errors.push({
          ideaId: idea.id,
          ideaName: idea.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with the next idea even if this one fails
      }
    }

    // Send individual emails to users and the summary email to admin
    if (processedIdeas.length > 0) {
      try {
        // Group ideas by user to send one email per user with all their briefings
        const userIdeasMap = new Map<string, typeof processedIdeas>();

        for (const idea of processedIdeas) {
          if (!userIdeasMap.has(idea.userId)) {
            userIdeasMap.set(idea.userId, []);
          }
          userIdeasMap.get(idea.userId)!.push(idea);
        }

        // Fetch user emails from Supabase
        for (const [userId, userIdeas] of userIdeasMap.entries()) {
          try {
            // First get profile info which might have user data
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userId)
              .single();

            if (profileError) {
              console.error(
                `Error fetching profile for user ${userId}:`,
                profileError
              );
            }

            // Get user email directly from auth.users table using service role
            const { data: userData, error: userError } = await supabase
              .from("auth.users")
              .select("email, raw_user_meta_data")
              .eq("id", userId)
              .single();

            if (userError || !userData) {
              console.error(
                `Error fetching user ${userId} for email notification:`,
                userError
              );
              continue;
            }

            const userEmail = userData.email;
            if (!userEmail) {
              console.error(
                `No email found for user ${userId}, skipping email notification`
              );
              continue;
            }

            // For each idea, send a personalized notification email
            for (const idea of userIdeas) {
              // Generate email HTML
              const siteUrl =
                process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
              // Use profile name if available, otherwise use metadata from auth.users
              const userName =
                profile?.full_name ||
                userData.raw_user_meta_data?.full_name ||
                "MACEI User";

              const emailHtml = generateBriefingEmail(
                userName,
                idea.name,
                idea.briefingId,
                idea.briefingSummary,
                siteUrl
              );

              // Send the email
              await sendEmail({
                to: userEmail,
                subject: `New Briefing for ${idea.name}`,
                html: emailHtml,
              });

              console.log(
                `Email notification sent to ${userEmail} for idea ${idea.name}`
              );
            }
          } catch (userEmailError) {
            console.error(
              `Error sending email to user ${userId}:`,
              userEmailError
            );
          }
        }

        // Send summary email to admin as before
        const adminEmail =
          process.env.ADMIN_EMAIL || "paxmoderationai@gmail.com";
        const date = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        // Generate HTML content for the admin email
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Weekly Briefing Generation Summary</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
              .header { background-color: #213547; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
              .success { color: #22c55e; }
              .error { color: #ef4444; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #213547; color: white; }
              .footer { margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Weekly Briefing Generation Summary</h1>
              <p>${date}</p>
            </div>
            <div class="content">
              <h2>Summary</h2>
              <p>The weekly briefing generation job has completed.</p>
              <p><span class="success">${
                processedIdeas.length
              }</span> briefings were successfully generated.</p>
              ${
                errors.length > 0
                  ? `<p><span class="error">${errors.length}</span> ideas encountered errors during processing.</p>`
                  : ""
              }
              
              <h3>Successfully Generated Briefings</h3>
              <table>
                <tr>
                  <th>Idea ID</th>
                  <th>Idea Name</th>
                  <th>User ID</th>
                </tr>
                ${processedIdeas
                  .map(
                    (idea) => `
                  <tr>
                    <td>${idea.id}</td>
                    <td>${idea.name}</td>
                    <td>${idea.userId}</td>
                  </tr>
                `
                  )
                  .join("")}
              </table>
              
              ${
                errors.length > 0
                  ? `
                <h3>Errors</h3>
                <table>
                  <tr>
                    <th>Idea ID</th>
                    <th>Idea Name</th>
                    <th>Error</th>
                  </tr>
                  ${errors
                    .map(
                      (error) => `
                    <tr>
                      <td>${error.ideaId}</td>
                      <td>${error.ideaName}</td>
                      <td>${error.error}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </table>
              `
                  : ""
              }
              
              <p>You can view these briefings in the dashboard.</p>
              <p><a href="${
                process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
              }/dashboard" style="display: inline-block; background-color: #213547; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Go to Dashboard</a></p>
            </div>
            <div class="footer">
              <p>This is an automated email from MACY. Please do not reply to this email.</p>
            </div>
          </body>
          </html>
        `;

        // Send the summary email
        await sendEmail({
          to: adminEmail,
          subject: `Weekly Briefing Generation Summary - ${processedIdeas.length} Briefings Created`,
          html,
        });

        console.log(`Summary email sent to ${adminEmail}`);
      } catch (emailError) {
        console.error("Error sending emails:", emailError);
      }
    }

    console.log("Weekly briefing generation job completed");
  } catch (error) {
    console.error("Error in generateAllIdeaBriefings:", error);
  }
}
