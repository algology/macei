import { NextResponse } from "next/server";
import { generateAllIdeaBriefings } from "@/lib/scheduled-tasks";

// This API endpoint is for manual or automated triggering of the scheduled task
export async function GET(request: Request) {
  try {
    // Check for API key for security (either in query params or in Authorization header)
    const { searchParams } = new URL(request.url);
    const queryApiKey = searchParams.get("key");
    const authHeader = request.headers.get("Authorization");
    const headerApiKey = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const apiKey = queryApiKey || headerApiKey;

    // Validate API key
    if (apiKey !== process.env.CRON_API_KEY) {
      console.error("Unauthorized attempt to access cron API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get userId parameter if provided (used for testing only)
    const userId = searchParams.get("userId");

    console.log("Triggering briefing generation job");

    // Generate briefings for all users (or specific user if testing)
    await generateAllIdeaBriefings(userId || undefined);

    return NextResponse.json({
      success: true,
      message: "Briefing generation job completed successfully",
    });
  } catch (error) {
    console.error("Error in cron API route:", error);
    return NextResponse.json(
      { error: "Failed to trigger job" },
      { status: 500 }
    );
  }
}
