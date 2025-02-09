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

type BreadcrumbItem = {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: "organization" | "mission" | "idea";
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    }

    fetchData();
  }, [router]);

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
    if (selectedItems.length === 0) {
      return (
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-gray-400">Select an organization to get started</p>
        </div>
      );
    }

    if (selectedItems.length === 1) {
      return <MissionCards organizationId={selectedItems[0].id} />;
    }

    if (selectedItems.length === 2) {
      return <IdeaCards missionId={selectedItems[1].id} />;
    }

    return children;
  };

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="h-16 border-b border-accent-2">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="hover:opacity-90">
              <Image src="/logo.svg" alt="Logo" width={90} height={26} />
            </Link>

            <nav className="flex items-center">
              <ul className="flex items-center">
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
              <button className="flex items-center gap-2 text-sm hover:bg-accent-1 rounded-md p-2">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-black font-medium">
                  {user.email?.[0].toUpperCase()}
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-accent-2 p-4">
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
            >
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/data"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
            >
              <Database className="w-4 h-4" />
              Data
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </nav>
        </aside>

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
