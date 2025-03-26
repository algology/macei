import { getServerSupabase } from "../../lib/supabase";

/**
 * Direct test function to create a notification using the service role
 * This bypasses any potential permission issues
 */
export async function testDirectNotificationCreation(
  userId: string,
  message: string = "Direct test"
) {
  try {
    console.log("testDirectNotificationCreation called for user:", userId);

    const supabase = getServerSupabase();

    const notificationData = {
      user_id: userId,
      title: `Direct Test - ${new Date().toLocaleTimeString()}`,
      content: `${message} - Created at ${new Date().toISOString()}`,
      notification_type: "direct-test",
      is_read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Direct test notification data:", notificationData);

    const { data, error } = await supabase
      .from("notifications")
      .insert(notificationData)
      .select();

    if (error) {
      console.error("Error in direct test notification:", error);
      return { success: false, error };
    }

    console.log("Direct test notification created:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error in testDirectNotificationCreation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
