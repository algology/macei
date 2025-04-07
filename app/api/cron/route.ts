import { NextResponse } from "next/server";
import { generateAllIdeaBriefings } from "@/lib/scheduled-tasks";
import { getServerSupabase } from "@/lib/supabase";

// Set the maximum duration for this function
export const maxDuration = 300; // 5 minutes

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
    
    console.log("Checking API key authorization...");
    console.log("Expected key:", process.env.CRON_API_KEY);
    console.log("Received key:", apiKey);
    
    // For development, allow bypass of API key check with special dev mode
    const isDev = process.env.NODE_ENV === "development";
    const forceBypass = searchParams.get("dev") === "true" && isDev;
    
    // Validate API key unless we're forcing bypass in dev mode
    if (!forceBypass && apiKey !== process.env.CRON_API_KEY) {
      console.error("Unauthorized attempt to access cron API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get userId parameter if provided (used for testing only)
    const userId = searchParams.get("userId");
    // Add a special flag to force sending user emails even in test mode
    const sendUserEmails = searchParams.get("sendUserEmails") === "true";
    // Option to test email access without running the full job
    const testEmailAccess = searchParams.get("testEmailAccess") === "true";

    // Special case to just test email access
    if (testEmailAccess && userId) {
      console.log("Testing email access for user:", userId);
      const supabase = getServerSupabase();
      
      // Try to get profile info
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        console.log("Profile data:", profile);
      }
      
      // Try multiple approaches to get user email
      let userEmail = null;
      let userName = null;
      
      // 1. Try profile (if it has email)
      if (profile && profile.email) {
        userEmail = profile.email;
        userName = profile.full_name;
        console.log("Found email in profile data");
      }
      
      // 2. Try admin API (preferred method for production)
      if (!userEmail) {
        console.log("Trying admin API to get user email");
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          
          if (userError) {
            console.error("Admin API error:", userError);
          } else if (userData && userData.user) {
            userEmail = userData.user.email;
            userName = userName || userData.user.user_metadata?.full_name;
            console.log("Found email via admin API");
          }
        } catch (err) {
          console.error("Exception using admin API:", err);
        }
      }
      
      // 3. Try ideas table as fallback
      if (!userEmail) {
        console.log("Trying ideas table for creator_email");
        const { data: ideas, error: ideasError } = await supabase
          .from("ideas")
          .select("creator_email")
          .eq("user_id", userId)
          .limit(1);
          
        if (ideasError) {
          console.error("Error fetching from ideas:", ideasError);
        } else if (ideas && ideas.length > 0 && ideas[0].creator_email) {
          userEmail = ideas[0].creator_email;
          console.log("Found email in ideas table");
        }
      }
      
      if (!userEmail) {
        return NextResponse.json({
          error: "Could not retrieve user email by any method",
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: "Successfully retrieved user email",
        email: userEmail,
        userName: userName || "MACY User",
      });
    }

    console.log("Triggering briefing generation job");
    console.log("User ID for testing:", userId || "none specified");
    console.log("Send user emails:", sendUserEmails);

    // Generate briefings for all users (or specific user if testing)
    await generateAllIdeaBriefings(userId || undefined, sendUserEmails);

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
