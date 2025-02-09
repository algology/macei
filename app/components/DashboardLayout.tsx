"use client";

import { useRouter } from "next/navigation";
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
import { IdeaCards } from "./IdeaCards";
import { OrganizationCards } from "./OrganizationCards";
import { SidebarNavigation } from "./SidebarNavigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";

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

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

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

        setUser(session.user);

        // Fetch profile data including avatar
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
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

  // Only redirect if not loading and no user
  if (!loading && !user) {
    router.push("/login");
    return null;
  }

  // Show loading state directly without wrapping in DashboardLayout
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const handleOrganizationSelect = (org: Organization) => {
    setSelectedItems([
      {
        id: String(org.id),
        name: org.name,
        icon: <Building2 className="w-[22px] h-[22px]" />,
        type: "organization",
      },
    ]);
  };

  const handleMissionSelect = (mission: Mission) => {
    const orgItem = selectedItems[0];
    setSelectedItems([
      orgItem,
      {
        id: String(mission.id),
        name: mission.name,
        icon: <Target className="w-[22px] h-[22px]" />,
        type: "mission",
      },
    ]);
  };

  const handleIdeaSelect = (idea: Idea) => {
    const [orgItem, missionItem] = selectedItems;
    setSelectedItems([
      orgItem,
      missionItem,
      {
        id: String(idea.id),
        name: idea.name,
        icon: <Lightbulb className="w-[22px] h-[22px]" />,
        type: "idea",
      },
    ]);
  };

  const renderDashboardContent = () => {
    // If we're on the settings page, render the children directly
    if (window.location.pathname === "/dashboard/settings") {
      return children;
    }

    // Otherwise, handle the existing organization/mission/idea flow
    if (selectedItems.length === 0) {
      return <OrganizationCards />;
    }

    if (selectedItems.length === 1) {
      return <MissionCards organizationId={selectedItems[0].id} />;
    }

    if (selectedItems.length === 2) {
      return <IdeaCards missionId={selectedItems[1].id} />;
    }

    return children;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="h-16 border-b border-accent-2">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hover:opacity-90 pt-1"
              onClick={(e) => {
                e.preventDefault();
                setSelectedItems([]);
              }}
            >
              <Image
                src="/favicon.svg"
                alt="Logo"
                width={40}
                height={40}
                className="invert"
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
                    selectedOrg={selectedItems[0]}
                  />
                </li>

                {selectedItems.length >= 1 && (
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
                        organizationId={selectedItems[0].id}
                        onSelect={handleMissionSelect}
                        selectedMission={selectedItems[1]}
                      />
                    </li>
                  </>
                )}

                {selectedItems.length >= 2 && (
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
                        missionId={selectedItems[1].id}
                        onSelect={handleIdeaSelect}
                        selectedIdea={selectedItems[2]}
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
            <button className="p-2 hover:bg-accent-1 rounded-md">
              <Bell className="w-4 h-4 text-gray-400" />
            </button>
            {user && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="relative w-8 h-8 rounded-full overflow-hidden border border-accent-2 hover:border-accent-1 transition-colors">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar"
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-green-500 flex items-center justify-center text-black font-medium">
                        {user.email?.[0].toUpperCase()}
                      </div>
                    )}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="w-48 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
                    sideOffset={4}
                    align="end"
                    alignOffset={-8}
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

      <div className="flex h-[calc(100vh-4rem)]">
        <SidebarNavigation
          expanded={isSidebarExpanded}
          setExpanded={setIsSidebarExpanded}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <main className="container mx-auto px-6 py-8">
            {renderDashboardContent()}
          </main>
        </main>
      </div>
    </div>
  );
}
