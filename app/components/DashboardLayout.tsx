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
import { IdeaCards } from "./IdeaCards";
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

  const renderDashboardContent = () => {
    if (pathname === "/dashboard/knowledge-graph") {
      return children;
    }

    if (pathname === "/dashboard/settings") {
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
