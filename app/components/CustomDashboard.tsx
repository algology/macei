"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  Calendar,
  MessageSquare,
  ChevronRight,
  ListChecks,
  ArrowRight,
  Lightbulb,
  FileText,
  X,
  ChevronDown,
  Bell,
  BellOff,
  ChevronUp,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Idea, Mission } from "./types";
import { KnowledgeBaseChat } from "./KnowledgeBaseChat";
import Link from "next/link";

// Define the expected structure from the Supabase query
interface IdeaData {
  id: number;
  name: string;
  category: string;
  status: string;
  summary: string;
  created_at: string;
  mission_id: string | number;
  auto_briefing_enabled: boolean;
  signals: string | null;
  conviction: string | null;
  conviction_rationale: string | null;
}

interface MissionWithIdeas {
  id: string | number;
  name: string;
  ideas: IdeaData[];
}

interface OrganizationWithMissionsAndIdeas {
  id: string | number;
  name: string;
  missions: MissionWithIdeas[] | null;
  organization_members: { count: number }[];
}

type MissionData = {
  id: string | number;
  name: string;
  organization: {
    id: string | number;
    name: string;
  };
  ideas?: any[];
};

// Define structure for the data used in rendering grouped by org
interface OrgRenderData {
  id: string | number;
  name: string;
  memberCount: number;
  missions: MissionData[];
}

export function CustomDashboard() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [briefings, setBriefings] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [collapsedMissions, setCollapsedMissions] = useState<
    Set<string | number>
  >(new Set());
  const [orgs, setOrgs] = useState<OrganizationWithMissionsAndIdeas[]>([]);

  // Chat related state - simplified
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [allIdeasData, setAllIdeasData] = useState<string>("");

  const router = useRouter();

  // Toggle mission collapse state
  const toggleMissionCollapse = (
    missionId: string | number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    const newCollapsed = new Set(collapsedMissions);
    if (newCollapsed.has(missionId)) {
      newCollapsed.delete(missionId);
    } else {
      newCollapsed.add(missionId);
    }
    setCollapsedMissions(newCollapsed);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true); // Start loading
      try {
        // Get current user session (needed for briefings fetch later)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          console.error("No active session found:", sessionError);
          setLoading(false);
          return;
        }
        const userId = session.user.id; // Keep userId for potential future use or logging
        console.log("Fetching dashboard data for user ID:", userId);

        // Fetch organizations with missions and ideas, relying on RLS on organizations
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select(`
            id,
            name,
            missions (
              id,
              name,
              ideas (
                id,
                name,
                category,
                status,
                summary,
                created_at,
                mission_id,
                auto_briefing_enabled,
                signals,
                conviction,
                conviction_rationale
              )
            ),
            organization_members (
              count
            )
          `);

        if (orgError) {
          console.error("Error fetching organizations and related data:", orgError);
          setIdeas([]);
          setBriefings({});
          setLoading(false);
          return;
        }

        console.log("Organization data received:", orgData?.length || 0);

        // Process the orgData to build missionMap and collect idea IDs
        const missionMap = new Map<string | number, MissionData>();
        const accessibleIdeaIds: number[] = [];
        let allIdeasText = "";

        orgData?.forEach((org) => {
          if (!org.missions) return;

          org.missions.forEach((mission) => {
            if (!mission.ideas || mission.ideas.length === 0) return;

            const missionId = mission.id;
            if (!missionMap.has(missionId)) {
              missionMap.set(missionId, {
                id: missionId,
                name: mission.name,
                organization: { id: org.id, name: org.name },
                ideas: [],
              });
            }

            const currentMission = missionMap.get(missionId)!;

            mission.ideas.forEach((idea) => {
              accessibleIdeaIds.push(idea.id);
              currentMission.ideas?.push(idea);
              allIdeasText += `Idea: ${idea.name} (ID: ${idea.id}, Mission: ${
                mission.name
              }, Org: ${org.name})\nStatus: ${idea.status}\nSummary: ${
                idea.summary
              }\nConviction: ${idea.conviction || "N/A"}\n---\n`;
            });
            currentMission.ideas?.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
          });
        });

        // Convert map values to array and sort missions by name (or org name then mission name)
        const sortedMissions = Array.from(missionMap.values()).sort((a, b) => {
          if (a.organization.name !== b.organization.name) {
            return a.organization.name.localeCompare(b.organization.name);
          }
          return a.name.localeCompare(b.name);
        });

        console.log("Processed Missions:", sortedMissions.length);
        setIdeas(sortedMissions);
        setAllIdeasData(allIdeasText);
        setOrgs(orgData || []);

        // --- Fetch Briefings based on accessible Idea IDs ---
        if (accessibleIdeaIds.length > 0) {
          const { data: briefingData, error: briefingError } = await supabase
            .from("briefings")
            .select(
              `
              *,
              idea:ideas(id, name)
            `
            )
            .in("idea_id", accessibleIdeaIds)
            .order("date_from", { ascending: false });

          if (briefingError) {
            console.error("Error fetching briefings:", briefingError);
            setBriefings({});
          } else {
            console.log("Briefings found:", briefingData?.length || 0);
            const groupedBriefings = briefingData?.reduce((acc, briefing) => {
              const ideaId = briefing.idea_id;
              if (!acc[ideaId]) {
                acc[ideaId] = [];
              }
              acc[ideaId].push(briefing);
              return acc;
            }, {} as Record<string, any[]>);

            setBriefings(groupedBriefings || {});
          }
        } else {
          console.log("No accessible ideas found, skipping briefing fetch.");
          setBriefings({});
        }
      } catch (error) {
        console.error("Unexpected error fetching dashboard data:", error);
        setIdeas([]);
        setBriefings({});
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "validated":
        return "bg-green-500/20 text-green-400 border-green-900";
      case "in review":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-900";
      case "ideation":
        return "bg-blue-500/20 text-blue-400 border-blue-900";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-900";
    }
  };

  const getConvictionColor = (conviction?: string) => {
    switch (conviction) {
      case "Compelling":
        return "bg-green-500/20 text-green-400 border-green-900";
      case "Conditional":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-900";
      case "Postponed":
        return "bg-purple-500/20 text-purple-400 border-purple-900";
      case "Unfeasible":
        return "bg-red-500/20 text-red-400 border-red-900";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-900";
    }
  };

  const parseIdeaAttributes = (
    signals: string | undefined | null
  ): string[] => {
    if (!signals) return [];

    try {
      if (signals.trim().startsWith("[") || signals.trim().startsWith("{")) {
        const parsed = JSON.parse(signals);

        if (Array.isArray(parsed)) {
          return parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          return Object.values(parsed).flat() as string[];
        }
      }

      return signals
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } catch (error) {
      return signals
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  };

  const handleCreateIdea = () => {
    if (ideas.length > 0 && ideas[0].organization) {
      router.push(`/dashboard/org/${ideas[0].organization.id}`);
    } else {
      router.push("/dashboard");
    }
  };

  const navigateToIdea = (
    organizationId: string | number | undefined,
    missionId: string | number | undefined,
    ideaId: string | number | undefined
  ) => {
    if (!organizationId || !missionId || !ideaId) {
      console.error("Missing navigation parameters:", {
        organizationId,
        missionId,
        ideaId,
      });

      router.push(`/dashboard/ideas/${ideaId}`);
      return;
    }

    router.push(
      `/dashboard/org/${organizationId}/mission/${missionId}/idea/${ideaId}`
    );
  };

  return (
    <div className="relative">
      {loading ? (
        <div className="text-gray-400 h-60 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading ideas and briefings...</span>
          </div>
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-gray-400 h-60 flex items-center justify-center">
          <span>
            No organizations found. Create one or ask an owner to invite you.
          </span>
        </div>
      ) : ideas.length === 0 ? (
        <div className="space-y-6 overflow-y-auto pr-1 flex-1">
          {orgs.map((org) => (
            <div key={org.id} className="mb-10">
              <div className="flex items-center justify-between mb-4 relative">
                <div className="w-10 h-10 rounded-full bg-accent-1/80 border-2 border-accent-2 flex items-center justify-center text-white font-medium mr-3">
                  {org.name.substring(0, 1).toUpperCase()}
                </div>
                <h3 className="text-xl font-bold text-white">{org.name}</h3>
              </div>
              <div className="text-gray-400 px-5">No missions or ideas yet</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-accent-2 scrollbar-track-transparent pr-1 flex-1">
          {(function () {
            const orgMap = new Map<string | number, OrgRenderData>();

            // Populate the map directly from orgData to include member count
            orgs.forEach(org => {
              if (!orgMap.has(org.id)) {
                orgMap.set(org.id, {
                  id: org.id,
                  name: org.name,
                  memberCount: org.organization_members?.[0]?.count ?? 0,
                  missions: [],
                });
              }
              const currentOrgEntry = orgMap.get(org.id)!;

              // Add missions belonging to this org
              org.missions?.forEach(mission => {
                if (mission.ideas && mission.ideas.length > 0) {
                  currentOrgEntry.missions.push({
                    id: mission.id,
                    name: mission.name,
                    // Include organization info within mission data if needed elsewhere
                    organization: { id: org.id, name: org.name },
                    ideas: mission.ideas,
                  });
                }
              });
              // Sort missions within the organization if needed (e.g., alphabetically)
              currentOrgEntry.missions.sort((a, b) => a.name.localeCompare(b.name));
            });

            // Now map over the values from our structured map
            return Array.from(orgMap.values()).map((org: OrgRenderData) => (
              <div key={org.id} className="mb-10">
                <div className="flex items-center justify-between mb-4 relative">
                  <div className="flex items-center flex-1 mr-4">
                    <div className="w-10 h-10 rounded-full bg-accent-1/80 border-2 border-accent-2 flex items-center justify-center text-white font-medium mr-3 relative shrink-0">
                      {org.name.substring(0, 1).toUpperCase()}
                    </div>
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <span className="truncate">{org.name}</span>
                      {/* Use the memberCount stored in the org data */} 
                      {org.memberCount > 1 && (
                        <span title="Shared Organization">
                          <Users
                            className="ml-2 h-4 w-4 text-gray-500 inline-block shrink-0"
                            aria-label="Shared Organization"
                          />
                        </span>
                      )}
                    </h3>
                  </div>
                  <Link
                    href={`/dashboard/org/${org.id}/edit`}
                    className="text-gray-400 hover:text-white transition-colors"
                    title={`Edit ${org.name}`}
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                </div>

                <div className="pl-5 space-y-6 relative">
                  <div className="absolute w-[1px] bg-gray-600/50 h-full left-5 top-0"></div>

                  {org.missions.map((mission: MissionData) => (
                    <div
                      key={mission.id}
                      className="rounded-lg p-4 bg-accent-1/40 relative"
                    >
                      <div
                        className="absolute h-[1px] bg-gray-600/50 w-[15px] top-8"
                        style={{ left: "1px" }}
                      ></div>

                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={(e) => toggleMissionCollapse(mission.id, e)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 border border-blue-900/50 relative">
                            {mission.name.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-medium text-white flex items-center gap-2">
                              <span>Mission:</span>
                              <span className="text-blue-300">
                                {mission.name}
                              </span>
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {mission.ideas?.length || 0} ideas
                          </span>
                          {collapsedMissions.has(mission.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {mission.ideas &&
                      mission.ideas.length > 0 &&
                      !collapsedMissions.has(mission.id) ? (
                        <div className="pl-4 mt-4 relative">
                          <div className="absolute w-[1px] bg-gray-600/50 h-full" />

                          <div className="space-y-4 ml-4">
                            {mission.ideas.map((idea: any) => {
                              const latestBriefing = briefings[idea.id]?.[0];

                              return (
                                <div
                                  key={idea.id}
                                  className="p-4 hover:bg-accent-1/50 transition-colors relative cursor-pointer"
                                  onClick={() =>
                                    navigateToIdea(
                                      mission.organization?.id,
                                      mission.id,
                                      idea.id
                                    )
                                  }
                                >
                                  <div
                                    className="absolute h-[1px] bg-gray-600/50 w-[15px] top-7"
                                    style={{ left: "-15px" }}
                                  ></div>

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-wrap gap-2">
                                      <div
                                        className="w-6 h-6 rounded-full bg-purple-900/30 flex items-center justify-center text-purple-400 text-xs border border-purple-900/50 relative"
                                        style={{ marginLeft: "-3px" }}
                                      >
                                        <Lightbulb className="w-3 h-3" />
                                      </div>
                                      <h5 className="font-medium text-white flex items-center gap-2">
                                        <span className="text-xs text-gray-400">
                                          Idea:
                                        </span>
                                        <span>{idea.name}</span>
                                      </h5>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                                          idea.status || "ideation"
                                        )}`}
                                      >
                                        <span className="opacity-70 mr-1">
                                          Status:
                                        </span>
                                        {idea.status || "ideation"}
                                      </span>

                                      {idea.conviction && (
                                        <span
                                          className={`relative group px-2 py-0.5 rounded-full text-xs ${getConvictionColor(
                                            idea.conviction
                                          )}`}
                                        >
                                          <span className="opacity-70 mr-1">
                                            Conviction:
                                          </span>
                                          {idea.conviction}
                                          {idea.conviction_rationale && (
                                            <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2 text-xs text-white bg-gray-950 rounded-md shadow-lg z-10 border border-accent-2 text-center">
                                              {idea.conviction_rationale}
                                            </div>
                                          )}
                                        </span>
                                      )}

                                      {idea.auto_briefing_enabled === false ? (
                                        <BellOff className="w-3.5 h-3.5 text-gray-400" />
                                      ) : (
                                        <Bell className="w-3.5 h-3.5 text-blue-400" />
                                      )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  </div>

                                  <div className="pl-8 mt-2">
                                    {idea.summary && (
                                      <p className="text-sm text-gray-300 mt-1 mb-2">
                                        {idea.summary}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                      {idea.category && (
                                        <span className="flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                          {idea.category}
                                        </span>
                                      )}

                                      {idea.created_at && (
                                        <span className="flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                          Created:{" "}
                                          {new Date(
                                            idea.created_at
                                          ).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>

                                    {idea.signals &&
                                      parseIdeaAttributes(idea.signals).length >
                                        0 && (
                                        <div className="mb-3">
                                          <div className="text-xs text-gray-400 mb-1">
                                            Attributes:
                                          </div>
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {parseIdeaAttributes(
                                              idea.signals
                                            ).map((attribute, idx) => (
                                              <span
                                                key={idx}
                                                className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-900"
                                              >
                                                {attribute}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                    <div className="mb-3">
                                      {latestBriefing ? (
                                        <div className="bg-accent-1 rounded-lg p-4 border border-accent-2 shadow-sm">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <FileText className="w-4 h-4 text-purple-400" />
                                              <h6 className="text-sm font-medium text-purple-300">
                                                Briefing
                                              </h6>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-gray-400">
                                                {(() => {
                                                  try {
                                                    return new Date(
                                                      latestBriefing.created_at
                                                    ).toLocaleDateString();
                                                  } catch (e) {
                                                    return "Unknown date";
                                                  }
                                                })()}
                                              </span>
                                              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                                                Latest
                                              </span>
                                            </div>
                                          </div>
                                          <p className="text-xs text-gray-300 mb-3">
                                            {latestBriefing.summary ||
                                              "No summary available"}
                                          </p>

                                          {latestBriefing.next_steps &&
                                            Array.isArray(
                                              latestBriefing.next_steps
                                            ) &&
                                            latestBriefing.next_steps.length >
                                              0 && (
                                              <div className="mt-3 pt-3 border-t border-accent-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <ListChecks className="w-3 h-3 text-blue-400" />
                                                  <h6 className="text-xs font-medium text-blue-300">
                                                    Next Steps
                                                  </h6>
                                                </div>
                                                <ul className="space-y-1 pl-4">
                                                  {latestBriefing.next_steps
                                                    .slice(0, 3)
                                                    .map(
                                                      (
                                                        step: string,
                                                        idx: number
                                                      ) => (
                                                        <li
                                                          key={idx}
                                                          className="text-xs text-gray-300 flex items-start"
                                                        >
                                                          <ArrowRight className="w-3 h-3 text-blue-400 mr-1 flex-shrink-0 mt-0.5" />
                                                          <span>{step}</span>
                                                        </li>
                                                      )
                                                    )}
                                                  {latestBriefing.next_steps
                                                    .length > 3 && (
                                                    <li className="text-xs text-gray-400">
                                                      +
                                                      {latestBriefing.next_steps
                                                        .length - 3}{" "}
                                                      more steps
                                                    </li>
                                                  )}
                                                </ul>
                                              </div>
                                            )}
                                        </div>
                                      ) : (
                                        <div className="bg-accent-1 rounded-lg p-4 border border-accent-2 shadow-sm text-center">
                                          <span className="text-xs text-gray-500">
                                            No briefings yet for this idea
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : mission.ideas &&
                        mission.ideas.length > 0 &&
                        collapsedMissions.has(mission.id) ? (
                        <div className="text-sm text-gray-400 p-3 text-center mt-2">
                          {mission.ideas.length} ideas hidden
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 p-3 text-center mt-2">
                          No ideas in this mission
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <button
        onClick={() => setIsChatExpanded(!isChatExpanded)}
        className="fixed bottom-6 right-20 z-50 w-12 h-12 rounded-full bg-green-500/20 text-green-400 border border-green-900 flex items-center justify-center shadow-lg hover:bg-green-500/30 transition-colors"
        aria-label="Toggle knowledge base chat"
        title="Chat with your knowledge base"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {isChatExpanded && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] sm:w-[600px] md:w-[720px] lg:w-[800px] xl:w-[1000px] 2xl:w-[1200px] max-w-[1400px] bg-accent-1/95 backdrop-blur-md border border-accent-2 rounded-xl h-[500px] shadow-lg shadow-accent-1/20 z-50 transition-all duration-300 ease-in-out">
          <div
            className="px-4 h-10 cursor-pointer flex items-center justify-between transition-colors rounded-t-xl"
            onClick={() => setIsChatExpanded(false)}
          >
            <h3 className="text-base font-semibold leading-none">
              Knowledge Base Chat
            </h3>
            <ChevronDown className="w-4 h-4" />
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-hidden">
            <div className="p-4 h-full">
              <KnowledgeBaseChat
                ideaDetails={{
                  id: 0,
                  name: "Global Knowledge Search",
                  category: "System",
                  status: "ideation",
                  signals: "",
                  created_at: new Date().toISOString(),
                  mission_id: "",
                }}
                documents={`### Global Knowledge Base Search

This is a search interface that lets you query information across all your ideas, briefings, and knowledge base entries.

IMPORTANT INSTRUCTIONS:
- This is NOT an idea - when listing ideas, DO NOT include "Global Knowledge Search" or "Knowledge Base Search" in the list
- Only list actual user ideas from the data below
- When asked about ideas, only mention the real ideas owned by the user

### Your Ideas:

${allIdeasData}`}
                onFocus={() => setIsChatExpanded(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
