import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { briefingId } = await request.json();

    if (!briefingId) {
      throw new Error("Briefing ID is required");
    }

    // Delete the briefing
    const { error } = await supabase
      .from("briefings")
      .delete()
      .eq("id", briefingId);

    if (error) {
      console.error("Error deleting briefing:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete-briefing:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete briefing",
      },
      { status: 500 }
    );
  }
}
