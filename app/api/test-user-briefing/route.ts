import { NextResponse } from "next/server";
import { sendEmail, generateBriefingEmail } from "@/lib/emailService";

// Simple endpoint to test user briefing email functionality
export async function GET(request: Request) {
  try {
    // Check for API key for security
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const email = searchParams.get("email") || "paxmoderationai@gmail.com";
    const isDev = process.env.NODE_ENV === "development";
    
    // Only allow with a valid API key or in dev mode
    if (!isDev && key !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parameters for the email
    const userName = searchParams.get("userName") || "MACY User";
    const ideaName = searchParams.get("ideaName") || "Test Idea";
    const briefingId = parseInt(searchParams.get("briefingId") || "999");
    const briefingSummary = searchParams.get("summary") || 
      "This is a test briefing summary. It would normally contain insights about your business idea based on market research and AI analysis.";
    
    console.log(`Sending test user briefing email to ${email}...`);
    
    // Generate the email using the same function used by the cron job
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const html = generateBriefingEmail(
      userName,
      ideaName,
      briefingId,
      briefingSummary,
      siteUrl
    );
    
    // Send the email
    const result = await sendEmail({
      to: email,
      subject: `New Briefing for ${ideaName}`,
      html,
    });
    
    return NextResponse.json({
      success: result,
      message: `Test user briefing email ${result ? "sent" : "failed to send"} to ${email}`,
      emailParameters: {
        userName,
        ideaName,
        briefingId,
        briefingSummary,
      }
    });
  } catch (error) {
    console.error("Error sending test user briefing email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
} 