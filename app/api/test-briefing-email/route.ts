import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { sendEmail, generateBriefingEmail } from "@/lib/emailService";

export async function GET(request: Request) {
  try {
    // Get email from query params
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get("email") || "id811point2@gmail.com";
    const ideaId = searchParams.get("ideaId");
    const userId = searchParams.get("userId");

    // Check for API key for security (optional in development)
    const apiKey = searchParams.get("key");
    const isDevMode = process.env.NODE_ENV === "development";

    if (!isDevMode && apiKey !== process.env.CRON_API_KEY) {
      console.error("Unauthorized attempt to access test email API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`Sending test briefing email to ${recipient}`);

    // Fetch data if needed
    const supabase = getServerSupabase();
    let ideaName = "Sample Idea";
    let userName = "MACEI User";

    if (ideaId) {
      const { data: idea, error } = await supabase
        .from("ideas")
        .select("name, user_id")
        .eq("id", ideaId)
        .single();

      if (error) {
        console.error("Error fetching idea:", error);
      } else if (idea) {
        ideaName = idea.name;

        // Try to get user profile
        if (idea.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", idea.user_id)
            .single();

          if (profile?.full_name) {
            userName = profile.full_name;
          } else {
            // Try to get name from auth.users
            const { data: userData } = await supabase
              .from("auth.users")
              .select("raw_user_meta_data")
              .eq("id", idea.user_id)
              .single();

            if (userData?.raw_user_meta_data?.full_name) {
              userName = userData.raw_user_meta_data.full_name;
            }
          }
        }
      }
    } else if (userId) {
      // If userId is provided directly
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      if (profile?.full_name) {
        userName = profile.full_name;
      } else {
        // Try to get name from auth.users
        const { data: userData } = await supabase
          .from("auth.users")
          .select("raw_user_meta_data")
          .eq("id", userId)
          .single();

        if (userData?.raw_user_meta_data?.full_name) {
          userName = userData.raw_user_meta_data.full_name;
        }
      }
    }

    // Generate a test briefing email
    const emailHtml = generateBriefingEmail(
      userName,
      ideaName,
      ideaId ? parseInt(ideaId) : 123,
      "This is a test briefing summary for your idea. It contains market intelligence and insights about your idea's viability.",
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    );

    // Send the test email
    const result = await sendEmail({
      to: recipient,
      subject: `New Briefing for ${ideaName}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: `Test briefing email sent to ${recipient}`,
      emailResult: result,
    });
  } catch (error) {
    console.error("Error sending test briefing email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
