import cron from "node-cron";
import { getServerSupabase } from "./supabase";
import { sendEmail, generateBriefingEmail } from "./emailService";

// DEPRECATED: This function is no longer used - we're using Vercel Cron instead
// Function to initialize cron jobs
/*
export function initScheduledTasks() {
  // Weekly briefing generation - runs every Thursday at 5:00 PM Adelaide time
  // (7:30 AM UTC during standard time or 6:30 AM UTC during daylight saving time)
  const weeklyBriefingJob = cron.schedule("0 7 * * 4", async () => {
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
*/

// Function to generate briefings for all active ideas
export async function generateAllIdeaBriefings(
  userId?: string,
  sendUserEmails: boolean = false
) {
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

        // Send user emails if explicitly requested or if it's a production run (not testing)
        if (sendUserEmails || !userId) {
          console.log("Sending user briefing notification emails...");
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

              // We need to get email directly from auth - but auth.users can't be accessed directly
              // Try a few approaches
              let userData = null;
              let userEmail = null;
              let userName = "MACY User";

              // Try to get profile first, which could have the email
              if (profile && profile.email) {
                userEmail = profile.email;
                userName = profile.full_name || "MACY User";
              }

              // If no email in profile, try to use admin-level direct access
              if (!userEmail) {
                console.log(
                  `Trying admin access to retrieve email for user ${userId}`
                );

                // Attempt to get it via the service role API (should work in production)
                const adminSupabase = getServerSupabase();
                const { data: users, error: usersError } =
                  await adminSupabase.auth.admin.getUserById(userId);

                if (!usersError && users && users.user) {
                  console.log("Successfully retrieved user via admin API");
                  userEmail = users.user.email;
                  userName =
                    profile?.full_name ||
                    users.user.user_metadata?.full_name ||
                    "MACY User";
                } else {
                  console.error(
                    "Error getting user via admin API:",
                    usersError
                  );
                }
              }

              // As a last resort, try to look up the user's email from the ideas table
              if (!userEmail) {
                console.log(
                  "Trying to retrieve email from creator_email in ideas table"
                );

                const { data: userIdeas, error: ideasError } = await supabase
                  .from("ideas")
                  .select("creator_email")
                  .eq("user_id", userId)
                  .limit(1);

                if (
                  !ideasError &&
                  userIdeas &&
                  userIdeas.length > 0 &&
                  userIdeas[0].creator_email
                ) {
                  userEmail = userIdeas[0].creator_email;
                }
              }

              if (!userEmail) {
                console.error(
                  `No email found for user ${userId} after multiple attempts, skipping email notification`
                );
                continue;
              }

              // For each idea, send a personalized notification email
              for (const idea of userIdeas) {
                // Generate email HTML
                const siteUrl =
                  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
                // Use profile name if available, otherwise use metadata from auth.users
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
        } else {
          console.log(
            "Skipping user emails (testing mode without sendUserEmails flag)"
          );
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
