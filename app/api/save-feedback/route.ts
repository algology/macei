import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Feedback content is required" },
        { status: 400 }
      );
    }

    // Default for optional fields
    const feedbackData = {
      user_id: session.user.id,
      content: body.content,
      page_url: body.page_url || null,
      component: body.component || null,
      rating: body.rating || null,
      idea_id: body.idea_id || null,
      mission_id: body.mission_id || null,
      organization_id: body.organization_id || null,
      tags: body.tags || [],
    };

    // Insert feedback into database
    const { data, error } = await supabase
      .from("feedback")
      .insert(feedbackData)
      .select("id, created_at");

    if (error) {
      console.error("Error saving feedback:", error);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    // Log feedback for analysis (optional)
    console.log(
      `Feedback received from ${session.user.email} on page ${
        body.page_url || "unknown"
      }`
    );

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Feedback saved successfully",
      data: data?.[0],
    });
  } catch (error) {
    console.error("Unexpected error in feedback endpoint:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
