import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/emailService";

// Test endpoint to simulate sending a cron job summary email
export async function GET(request: Request) {
  try {
    // Check for an API key for security
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    // Only allow with a valid API key (use the CRON_API_KEY for simplicity)
    if (key !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipient =
      searchParams.get("email") ||
      process.env.ADMIN_EMAIL ||
      "paxmoderationai@gmail.com";

    console.log(`Attempting to send test summary email to ${recipient}...`);

    // Mock data for generated briefings
    const processedIdeas = [
      {
        id: 123,
        name: "AI Lead Gen Tool",
        userId: "42f75a4a-ac23-442c-96ec-74499a32116e",
      },
      {
        id: 124,
        name: "PAX Content Moderation",
        userId: "7d620f1c-9657-4130-a6eb-63613a2f3196",
      },
      {
        id: 125,
        name: "PipeAssess",
        userId: "b552ac7c-fc2f-43b1-ad1a-8d97bd72364e",
      },
    ];

    const errors = [
      {
        ideaId: 126,
        ideaName: "Example Error Idea",
        error: "Failed to generate briefing: API rate limit exceeded",
      },
    ];

    // Create a summary of all processed ideas
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate HTML content for the email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Briefing Generation Summary (Test)</title>
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
          <h1>Weekly Briefing Generation Summary (TEST)</h1>
          <p>${date}</p>
        </div>
        <div class="content">
          <h2>Summary</h2>
          <p>This is a <strong>TEST</strong> email showing how the weekly briefing summary will look.</p>
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
          
          <p>In production, you would be able to view these briefings in the dashboard.</p>
          <p><a href="${
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          }/dashboard" style="display: inline-block; background-color: #213547; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Go to Dashboard</a></p>
        </div>
        <div class="footer">
          <p>This is a TEST email from MACY. No actual briefings were generated.</p>
        </div>
      </body>
      </html>
    `;

    // Send the summary email
    const result = await sendEmail({
      to: recipient,
      subject: `Weekly Briefing Generation Summary - ${processedIdeas.length} Briefings Created`,
      html,
    });

    return NextResponse.json({
      success: true,
      message: `Test summary email sent to ${recipient}`,
      emailResult: result,
    });
  } catch (error) {
    console.error("Error sending test summary email:", error);
    return NextResponse.json(
      { error: "Failed to send test summary email" },
      { status: 500 }
    );
  }
}
