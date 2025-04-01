import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { briefingId } = await request.json();

    if (!briefingId) {
      throw new Error("Briefing ID is required");
    }

    // Check if there are knowledge base entries referencing this briefing
    const { data: knowledgeBaseEntries, error: checkError } = await supabase
      .from("knowledge_base")
      .select("id")
      .eq("briefing_id", briefingId);

    if (checkError) {
      console.error("Error checking knowledge_base entries:", checkError);
      throw checkError;
    }

    console.log(
      `Found ${knowledgeBaseEntries?.length} knowledge base entries referencing briefing ${briefingId}`
    );

    // Update each knowledge base entry individually
    if (knowledgeBaseEntries && knowledgeBaseEntries.length > 0) {
      for (const entry of knowledgeBaseEntries) {
        const { error: updateError } = await supabase
          .from("knowledge_base")
          .update({ briefing_id: null })
          .eq("id", entry.id);

        if (updateError) {
          console.error(
            `Error updating knowledge base entry ${entry.id}:`,
            updateError
          );
          throw updateError;
        }
      }
      console.log(
        `Successfully updated all ${knowledgeBaseEntries.length} knowledge base entries`
      );
    }

    // Delete notifications related to this briefing
    const { error: deleteNotifError } = await supabase
      .from("notifications")
      .delete()
      .eq("briefing_id", briefingId);

    if (deleteNotifError) {
      console.error("Error deleting notifications:", deleteNotifError);
      throw deleteNotifError;
    }

    // Double-check that there are no more references before deleting
    const { data: remainingEntries, error: checkAgainError } = await supabase
      .from("knowledge_base")
      .select("id")
      .eq("briefing_id", briefingId);

    if (checkAgainError) {
      console.error(
        "Error checking remaining knowledge_base entries:",
        checkAgainError
      );
      throw checkAgainError;
    }

    if (remainingEntries && remainingEntries.length > 0) {
      console.error(
        `Still found ${remainingEntries.length} knowledge base entries referencing briefing ${briefingId}`
      );
      throw new Error("Failed to update all references to the briefing");
    }

    // Finally delete the briefing
    const { error } = await supabase
      .from("briefings")
      .delete()
      .eq("id", briefingId);

    if (error) {
      console.error("Error deleting briefing:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted briefing ${briefingId} and updated ${
        knowledgeBaseEntries?.length || 0
      } knowledge base entries`,
    });
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
