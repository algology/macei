"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutGrid,
  Settings,
  Database,
  Bell,
  Search,
  ChevronDown,
  Building2,
  Target,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { OrganizationSelector } from "./OrganizationSelector";
import { Organization, Mission, Idea } from "./types";
import { MissionSelector } from "./MissionSelector";
import { IdeaSelector } from "./IdeaSelector";
import { MissionCards } from "./MissionCards";
import { IdeaCards } from "./IdeaTable";
import { OrganizationCards } from "./OrganizationCards";
import { SidebarNavigation } from "./SidebarNavigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";

type BreadcrumbItem = {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: "organization" | "mission" | "idea";
};

type Profile = {
  id: string;
  avatar_url: string | null;
  full_name: string | null;
  updated_at: string;
};

interface Notification {
  id: number;
  title: string;
  content: string;
  idea_id?: number;
  briefing_id?: number;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [isBreadcrumbsLoading, setIsBreadcrumbsLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState<
    Notification[]
  >([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    async function fetchUserAndProfile() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        // Ensure profile exists
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert({
            id: session.user.id,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (upsertError) {
          console.error("Error upserting profile:", upsertError);
        }

        // Then fetch profile data including avatar
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }

        setUser(session.user);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserAndProfile();

    // Subscribe to auth changes AND profile changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
    });

    // Subscribe to profile changes
    const profileSubscription = supabase
      .channel("public:profiles")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user?.id}`,
        },
        async (payload) => {
          // When profile changes, update avatar URL
          if (payload.new && "avatar_url" in payload.new) {
            setAvatarUrl((payload.new as Profile).avatar_url);
          }
        }
      )
      .subscribe();

    return () => {
      authSubscription.unsubscribe();
      profileSubscription.unsubscribe();
    };
  }, [router, user?.id]);

  useEffect(() => {
    async function updateBreadcrumbs() {
      setIsBreadcrumbsLoading(true);
      const paths = pathname.split("/").filter(Boolean);
      if (paths[0] !== "dashboard") return;

      const newBreadcrumbs: BreadcrumbItem[] = [];

      if (paths[2]) {
        // orgId exists
        const { data: org } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", paths[2])
          .single();

        if (org) {
          newBreadcrumbs.push({
            id: String(org.id),
            name: org.name,
            icon: <Building2 className="w-[22px] h-[22px]" />,
            type: "organization",
          });
        }
      }

      if (paths[4]) {
        // missionId exists
        const { data: mission } = await supabase
          .from("missions")
          .select("*")
          .eq("id", paths[4])
          .single();

        if (mission) {
          newBreadcrumbs.push({
            id: String(mission.id),
            name: mission.name,
            icon: <Target className="w-[22px] h-[22px]" />,
            type: "mission",
          });
        }
      }

      if (paths[6]) {
        // ideaId exists
        const { data: idea } = await supabase
          .from("ideas")
          .select("*")
          .eq("id", paths[6])
          .single();

        if (idea) {
          newBreadcrumbs.push({
            id: String(idea.id),
            name: idea.name,
            icon: <Lightbulb className="w-[22px] h-[22px]" />,
            type: "idea",
          });
        }
      }

      setBreadcrumbs(newBreadcrumbs);
      setIsBreadcrumbsLoading(false);
    }

    updateBreadcrumbs();
  }, [pathname]);

  useEffect(() => {
    // Only fetch if user is logged in
    if (user) {
      console.log("User is logged in, setting up notifications:", user.id);

      // Fetch immediately on load
      fetchUnreadNotifications();

      // Then set up a periodic refresh every 10 seconds (reduced from 30s for testing)
      const intervalId = setInterval(() => {
        console.log("Running notification refresh interval");
        fetchUnreadNotifications();
      }, 10000);

      // Also set up real-time subscription for notifications
      try {
        console.log("Setting up real-time notification subscription");

        const notificationSubscription = supabase
          .channel(`user-notifications-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log("Real-time notification received:", payload);
              // Refresh notifications when a new one is inserted
              fetchUnreadNotifications();
            }
          )
          .subscribe((status) => {
            console.log("Notification subscription status:", status);
          });

        // Clear the interval and subscription when component unmounts
        return () => {
          clearInterval(intervalId);
          notificationSubscription.unsubscribe();
        };
      } catch (subError) {
        console.error("Error setting up notification subscription:", subError);
        // Fallback to just clearing the interval
        return () => clearInterval(intervalId);
      }
    }
  }, [user]);

  // Only redirect if not loading and no user
  if (!loading && !user) {
    router.push("/login");
    return null;
  }

  const handleOrganizationSelect = (org: Organization) => {
    router.push(`/dashboard/org/${org.id}`);
  };

  const handleMissionSelect = (mission: Mission) => {
    router.push(
      `/dashboard/org/${mission.organization_id}/mission/${mission.id}`
    );
  };

  const handleIdeaSelect = (idea: Idea) => {
    router.push(
      `/dashboard/org/${idea.mission?.organization_id}/mission/${idea.mission_id}/idea/${idea.id}`
    );
  };

  const fetchUnreadNotifications = async () => {
    try {
      console.log("=== DASHBOARD NOTIFICATION DEBUG ===");
      console.log("Fetching unread notifications for user:", user?.id);

      if (!user?.id) {
        console.log("No user ID available, cannot fetch notifications");
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, title, content, is_read, created_at, idea_id, briefing_id, notification_type"
        )
        .eq("user_id", user?.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      // Also try to get all notifications to see what's there
      const { data: allNotifications, error: allError } = await supabase
        .from("notifications")
        .select("id, user_id")
        .limit(10);

      console.log("All recent notifications in system:", allNotifications);

      if (allError) {
        console.error("Error fetching all notifications:", allError);
      }

      console.log(`Found ${data?.length || 0} unread notifications`);
      if (data && data.length > 0) {
        console.log("Notification details:", data[0]);
      }
      console.log("=== END DASHBOARD NOTIFICATION DEBUG ===");

      setUnreadNotifications(data || []);
    } catch (error) {
      console.error("Error in fetchUnreadNotifications:", error);
    }
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error marking notification as read:", error);
        return;
      }

      // Update local state to remove the notification
      setUnreadNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );
    } catch (error) {
      console.error("Error in markNotificationAsRead:", error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("user_id", user?.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error marking all notifications as read:", error);
        return;
      }

      // Clear local state
      setUnreadNotifications([]);
    } catch (error) {
      console.error("Error in markAllNotificationsAsRead:", error);
    }
  };

  const navigateToNotification = (notification: Notification) => {
    // Close the dropdown
    setIsNotificationsOpen(false);

    // Mark as read
    markNotificationAsRead(notification.id);

    // Navigate to the appropriate page based on notification type
    if (notification.idea_id && notification.briefing_id) {
      // If it has both, navigate to the idea's briefing
      router.push(
        `/dashboard/ideas/${notification.idea_id}?tab=briefings&briefing=${notification.briefing_id}`
      );
    } else if (notification.idea_id) {
      // If it just has idea_id, navigate to the idea
      router.push(`/dashboard/ideas/${notification.idea_id}`);
    }
  };

  const renderDashboardContent = () => {
    // Special routes that should always render children directly
    if (
      pathname === "/dashboard/knowledge-graph" ||
      pathname === "/dashboard/settings" ||
      pathname.includes("/edit")
    ) {
      return children;
    }

    if (isBreadcrumbsLoading) {
      return <LoadingSpinner />;
    }

    if (breadcrumbs.length === 0) {
      return <OrganizationCards onSelect={handleOrganizationSelect} />;
    }

    if (breadcrumbs.length === 1) {
      return (
        <MissionCards
          organizationId={breadcrumbs[0].id}
          onSelect={handleMissionSelect}
        />
      );
    }

    if (breadcrumbs.length === 2) {
      return <IdeaCards missionId={breadcrumbs[1].id} />;
    }

    return children;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation - Full Width */}
      <header className="h-16 border-b border-accent-2 fixed top-0 left-0 right-0 z-50 bg-background">
        <div className="h-full px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hover:opacity-90 pt-1"
              onClick={(e) => {
                e.preventDefault();
                router.push("/dashboard");
              }}
            >
              <Image
                src="/logo_small.svg"
                alt="Logo"
                width={40}
                height={40}
                className="invert"
                style={{ height: "auto" }}
              />
            </Link>

            <nav className="flex items-center">
              <ul className="flex items-center">
                <li className="mx-2">
                  <svg
                    className="w-[22px] h-[22px] text-gray-400"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M4.015 15.394l0.295-0.69l6-14l0.295-0.69l1.379 0.591l-0.295 0.69l-6 14l-0.295 0.69l-1.379-0.591z"
                      fill="currentColor"
                    />
                  </svg>
                </li>
                <li className="flex items-center min-w-0">
                  <OrganizationSelector
                    onSelect={handleOrganizationSelect}
                    selectedOrg={breadcrumbs[0]}
                  />
                </li>

                {breadcrumbs.length >= 1 && (
                  <>
                    <li className="mx-2">
                      <svg
                        className="w-[22px] h-[22px] text-gray-400"
                        viewBox="0 0 16 16"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M4.015 15.394l0.295-0.69l6-14l0.295-0.69l1.379 0.591l-0.295 0.69l-6 14l-0.295 0.69l-1.379-0.591z"
                          fill="currentColor"
                        />
                      </svg>
                    </li>
                    <li className="flex items-center min-w-0">
                      <MissionSelector
                        organizationId={breadcrumbs[0].id}
                        onSelect={handleMissionSelect}
                        selectedMission={breadcrumbs[1]}
                      />
                    </li>
                  </>
                )}

                {breadcrumbs.length >= 2 && (
                  <>
                    <li className="mx-2">
                      <svg
                        className="w-[22px] h-[22px] text-gray-400"
                        viewBox="0 0 16 16"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M4.015 15.394l0.295-0.69l6-14l0.295-0.69l1.379 0.591l-0.295 0.69l-6 14l-0.295 0.69l-1.379-0.591z"
                          fill="currentColor"
                        />
                      </svg>
                    </li>
                    <li className="flex items-center min-w-0">
                      <IdeaSelector
                        missionId={breadcrumbs[1].id}
                        onSelect={handleIdeaSelect}
                        selectedIdea={breadcrumbs[2]}
                      />
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-accent-1 rounded-md">
              <Search className="w-4 h-4 text-gray-400" />
            </button>
            <DropdownMenu.Root
              open={isNotificationsOpen}
              onOpenChange={setIsNotificationsOpen}
            >
              <DropdownMenu.Trigger asChild>
                <button className="p-2 hover:bg-accent-1 rounded-md relative bell-icon-container">
                  <Bell className="w-4 h-4 text-gray-400" />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 text-xs bg-red-500 text-white rounded-full flex items-center justify-center transform translate-x-1 -translate-y-1">
                      {unreadNotifications.length > 9
                        ? "9+"
                        : unreadNotifications.length}
                    </span>
                  )}
                  <span className="sr-only">
                    Notifications - {unreadNotifications.length} unread
                  </span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="w-80 bg-background border border-accent-2 rounded-lg shadow-lg p-2 animate-in fade-in-0 zoom-in-95"
                  sideOffset={8}
                  align="end"
                  style={{ zIndex: 100 }}
                >
                  <div className="flex justify-between items-center p-2 border-b border-accent-2 mb-2">
                    <h3 className="font-medium">Notifications</h3>
                    {unreadNotifications.length > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {unreadNotifications.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        No new notifications
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {unreadNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="p-3 hover:bg-accent-1 rounded-md cursor-pointer"
                            onClick={() => navigateToNotification(notification)}
                          >
                            <div className="font-medium">
                              {notification.title}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              {notification.content}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              {new Date(
                                notification.created_at
                              ).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {user && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="w-8 h-8 hover:bg-accent-1 rounded-full flex items-center justify-center">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar"
                        width={24}
                        height={24}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-black font-medium">
                        {user.email?.[0].toUpperCase()}
                      </div>
                    )}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="w-48 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
                    sideOffset={8}
                    align="end"
                    style={{ zIndex: 100 }}
                  >
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-accent-1 rounded-md outline-none cursor-pointer"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={async () => {
                        await supabase.auth.signOut();
                        router.push("/login");
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-accent-1 rounded-md outline-none cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area - Below Header */}
      <div className="pt-16 flex">
        <SidebarNavigation
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed(!isCollapsed)}
        />
        <main
          className={`flex-1 ${
            isCollapsed ? "ml-20" : "ml-52"
          } transition-all duration-300 p-6`}
        >
          {renderDashboardContent()}
        </main>
      </div>
    </div>
  );
}
