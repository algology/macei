import { getServerSupabase } from "./supabase";

export interface CreateNotificationOptions {
  userId: string;
  title: string;
  content: string;
  ideaId?: number;
  briefingId?: number;
  notificationType?: "briefing" | "signal" | "insight";
}

/**
 * Creates a new notification in the database for a user
 */
export async function createNotification({
  userId,
  title,
  content,
  ideaId,
  briefingId,
  notificationType = "briefing",
}: CreateNotificationOptions): Promise<boolean> {
  try {
    console.log("createNotification called with:", {
      userId,
      title: title.substring(0, 20) + "...",
      ideaId,
      briefingId,
      notificationType,
    });

    const supabase = getServerSupabase();

    const notificationData = {
      user_id: userId,
      title,
      content,
      idea_id: ideaId,
      briefing_id: briefingId,
      notification_type: notificationType,
      is_read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Inserting notification data:", notificationData);

    const { data, error } = await supabase
      .from("notifications")
      .insert(notificationData)
      .select();

    if (error) {
      console.error("Error creating notification:", error);
      return false;
    }

    console.log("Notification created successfully:", data);
    return true;
  } catch (error) {
    console.error("Error in createNotification:", error);
    return false;
  }
}

/**
 * Fetches all unread notifications for a user
 */
export async function getUnreadNotifications(userId: string) {
  try {
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching unread notifications:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getUnreadNotifications:", error);
    return [];
  }
}

/**
 * Marks a notification as read
 */
export async function markNotificationAsRead(
  notificationId: number,
  userId: string
): Promise<boolean> {
  try {
    const supabase = getServerSupabase();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markNotificationAsRead:", error);
    return false;
  }
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<boolean> {
  try {
    const supabase = getServerSupabase();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markAllNotificationsAsRead:", error);
    return false;
  }
}
