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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Idea, Mission } from "./types";
import { KnowledgeBaseChat } from "./KnowledgeBaseChat";

type MissionData = {
  id: string | number;
  name: string;
  organization: {
    id: string | number;
    name: string;
  };
};

export function CustomDashboard() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat related state - simplified
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [allIdeasData, setAllIdeasData] = useState<string>("");

  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          console.error("No active session found");
          return;
        }

        const userId = session.user.id;
        console.log("Fetching data for user ID:", userId);

        // Get all ideas directly owned by the user with their related missions
        const { data: userIdeas, error: ideasError } = await supabase
          .from("ideas")
          .select(
            `
            id,
            name,
            category,
            status,
            summary,
            created_at,
            mission_id,
            mission:missions(
              id,
              name,
              organization:organizations(id, name)
            )
          `
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (ideasError) {
          console.error("Error fetching user ideas:", ideasError);
        } else {
          console.log("User ideas found:", userIdeas?.length || 0);

          // Debug log the first idea to understand structure
          if (userIdeas && userIdeas.length > 0) {
            console.log(
              "Sample idea structure:",
              JSON.stringify(userIdeas[0], null, 2)
            );
          }

          // Group ideas by mission - use type assertion for any to bypass strict checking
          const missionMap = new Map<string | number, any>();

          userIdeas?.forEach((idea: any) => {
            if (idea.mission) {
              const missionId = idea.mission.id;

              if (!missionMap.has(missionId)) {
                missionMap.set(missionId, {
                  id: missionId,
                  name: idea.mission.name,
                  organization: idea.mission.organization,
                  ideas: [],
                });
              }

              // Add idea to this mission's ideas array
              missionMap.get(missionId).ideas.push({
                id: idea.id,
                name: idea.name,
                category: idea.category,
                status: idea.status,
                summary: idea.summary,
                created_at: idea.created_at,
                mission_id: idea.mission_id,
              });
            }
          });

          const missions = Array.from(missionMap.values());
          console.log("Grouped missions:", missions.length);
          setIdeas(missions);

          // If no ideas, skip fetching briefings
          if (!userIdeas || userIdeas.length === 0) {
            setBriefings([]);
            setLoading(false);
            return;
          }

          // Get idea IDs for briefings query
          const ideaIds = userIdeas.map((idea) => idea.id);

          // Fetch recent briefings for user's ideas
          const { data: recentBriefings, error: briefingError } = await supabase
            .from("briefings")
            .select(
              `
              id,
              idea_id,
              summary,
              date_from,
              date_to,
              created_at,
              key_attributes,
              next_steps,
              idea:ideas(
                name, 
                mission_id, 
                mission:missions(
                  name, 
                  organization_id, 
                  organization:organizations(name)
                )
              )
            `
            )
            .in("idea_id", ideaIds)
            .order("created_at", { ascending: false })
            .limit(5);

          if (briefingError) {
            console.error("Error fetching briefings:", briefingError);
          } else {
            console.log("Briefings found:", recentBriefings?.length || 0);
            setBriefings(recentBriefings || []);
          }

          // If ideas were found, create a context string for the chat
          if (userIdeas && userIdeas.length > 0) {
            // Create a string of all ideas and their data for the knowledge base chat
            const ideasContext = userIdeas
              .map((idea: any) => {
                return `Idea: ${idea.name}
Status: ${idea.status || "ideation"}
Summary: ${idea.summary || "No summary available"}
Mission: ${idea.mission?.name || "N/A"}
Organization: ${idea.mission?.organization?.name || "N/A"}
---`;
              })
              .join("\n\n");

            // Add briefings data to the context if available
            let briefingsContext = "";
            if (recentBriefings && recentBriefings.length > 0) {
              briefingsContext =
                "\n\n### Recent Briefings:\n\n" +
                recentBriefings
                  .map((briefing: any) => {
                    return `Briefing for Idea: ${
                      briefing.idea?.name || "Unknown Idea"
                    }
Summary: ${briefing.summary || "No summary available"}
Date Created: ${new Date(briefing.created_at).toLocaleDateString()}
Key Attributes: ${
                      briefing.key_attributes
                        ? briefing.key_attributes.join(", ")
                        : "None"
                    }
Next Steps: ${briefing.next_steps ? briefing.next_steps.join(", ") : "None"}
---`;
                  })
                  .join("\n\n");
            } else {
              briefingsContext =
                "\n\n### Recent Briefings:\n\nNo recent briefings found.";
            }

            setAllIdeasData(ideasContext + briefingsContext);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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

  const handleCreateIdea = () => {
    // First check if the user has any organizations
    if (ideas.length > 0 && ideas[0].organization) {
      // Navigate to the first organization's page
      router.push(`/dashboard/org/${ideas[0].organization.id}`);
    } else {
      // If no organizations, go to dashboard to create one first
      router.push("/dashboard");
    }
  };

  const navigateToIdea = (
    organizationId: string | undefined,
    missionId: string | undefined,
    ideaId: string | undefined
  ) => {
    if (!organizationId || !missionId || !ideaId) {
      console.error("Missing navigation parameters:", {
        organizationId,
        missionId,
        ideaId,
      });

      // Fallback to direct idea page
      router.push(`/dashboard/ideas/${ideaId}`);
      return;
    }

    router.push(
      `/dashboard/org/${organizationId}/mission/${missionId}/idea/${ideaId}`
    );
  };

  return (
    <div className="space-y-8 relative">
      {/* Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Date - Redesigned */}
        <div className="bg-accent-1/30 rounded-xl border border-accent-2 p-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-6 h-6 text-gray-400 mr-2" />
            <h3 className="text-lg font-medium">Today's Date</h3>
          </div>
          <div className="flex items-center">
            <div className="w-20 h-20 rounded-full bg-accent-1/70 border border-accent-2 flex items-center justify-center mr-4">
              <span className="text-4xl font-light text-white">
                {new Date().getDate()}
              </span>
            </div>
            <div>
              <p className="text-xl text-white">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  year: "numeric",
                }).format(new Date())}
              </p>
            </div>
          </div>
        </div>

        {/* Create New Idea Button */}
        <div className="bg-accent-1/30 rounded-xl border border-accent-2 p-6 flex flex-col justify-between">
          <h3 className="text-lg font-medium mb-4">Ready for a new idea?</h3>
          <button
            onClick={handleCreateIdea}
            className="w-full py-3 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors hover:shadow-inner flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Idea</span>
          </button>
        </div>
      </div>

      {/* Ideas and Briefings Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ideas by Mission */}
        <div className="bg-accent-1/30 rounded-xl border border-accent-2 p-6">
          <h3 className="text-xl font-medium mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 text-blue-400 mr-2" />
            Ideas by Mission
          </h3>

          {loading ? (
            <div className="text-gray-400 h-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading ideas...</span>
              </div>
            </div>
          ) : ideas.length === 0 ? (
            <div className="text-gray-400 h-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <span>No ideas found</span>
                <button
                  onClick={handleCreateIdea}
                  className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-900 rounded-lg hover:bg-blue-500/30 transition-colors"
                >
                  Create your first idea
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-accent-2 scrollbar-track-transparent pr-1">
              {ideas.map((mission) => (
                <div
                  key={mission.id}
                  className="border-b border-accent-2 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-white">
                      {mission.name}
                    </span>
                    <span className="text-sm text-gray-400">
                      ({mission.organization?.name})
                    </span>
                  </div>

                  {mission.ideas && mission.ideas.length > 0 ? (
                    <div className="space-y-2">
                      {mission.ideas.map((idea: any) => (
                        <div
                          key={idea.id}
                          onClick={() =>
                            navigateToIdea(
                              mission.organization?.id,
                              mission.id,
                              idea.id
                            )
                          }
                          className="flex items-center justify-between p-3 rounded-lg bg-accent-1/40 hover:bg-accent-1/70 cursor-pointer transition-colors border border-transparent hover:border-accent-2"
                        >
                          <div className="flex flex-col w-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white font-medium">
                                  {idea.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                                    idea.status || "ideation"
                                  )}`}
                                >
                                  {idea.status || "ideation"}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>

                            {idea.summary && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                                {idea.summary}
                              </p>
                            )}

                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {idea.category && (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                  {idea.category}
                                </span>
                              )}

                              {idea.created_at && (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                  {new Date(
                                    idea.created_at
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 p-3 rounded-lg bg-accent-1/40 text-center">
                      No ideas in this mission
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Briefings - Non-clickable */}
        <div className="bg-accent-1/30 rounded-xl border border-accent-2 p-6">
          <h3 className="text-xl font-medium mb-4 flex items-center">
            <FileText className="w-5 h-5 text-purple-400 mr-2" />
            Latest Briefings
          </h3>

          {loading ? (
            <div className="text-gray-400 h-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading briefings...</span>
              </div>
            </div>
          ) : briefings.length === 0 ? (
            <div className="text-gray-400 h-40 flex items-center justify-center">
              No briefings found
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-accent-2 scrollbar-track-transparent pr-1">
              {briefings.map((briefing) => (
                <div
                  key={briefing.id}
                  className="p-4 border border-accent-2 rounded-lg bg-accent-1/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      {briefing.idea?.name || "Unnamed Idea"}
                    </h4>
                    <span className="text-xs text-gray-400 bg-accent-1/50 px-2 py-1 rounded-full">
                      {new Date(briefing.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2 mt-1">
                    {briefing.summary}
                  </p>
                  <div className="flex items-center text-xs text-gray-400 mt-3 bg-accent-1/30 rounded-lg p-2">
                    {briefing.idea?.mission?.name && (
                      <>
                        <span>{briefing.idea.mission.name}</span>
                        <span className="mx-1">•</span>
                      </>
                    )}
                    <span>
                      {briefing.idea?.mission?.organization?.name ||
                        "Unknown Organization"}
                    </span>
                  </div>

                  {/* Show key attributes if available */}
                  {briefing.key_attributes &&
                    briefing.key_attributes.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {briefing.key_attributes
                          .slice(0, 3)
                          .map((attr: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs bg-purple-900/20 text-purple-300 px-2 py-0.5 rounded-full"
                            >
                              {attr}
                            </span>
                          ))}
                        {briefing.key_attributes.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{briefing.key_attributes.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggested Next Steps Section - Non-clickable */}
      <div className="bg-accent-1/30 rounded-xl border border-accent-2 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-5 h-5 text-blue-400" />
          <h3 className="text-xl font-medium">Suggested Next Steps</h3>
        </div>

        {loading ? (
          <div className="text-gray-400 h-40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading suggested steps...</span>
            </div>
          </div>
        ) : briefings.length === 0 ? (
          <div className="text-gray-400 h-40 flex items-center justify-center">
            No suggested steps found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefings
              .filter((b) => b.next_steps && b.next_steps.length > 0)
              .flatMap((briefing) =>
                briefing.next_steps.map((step: string, idx: number) => ({
                  step,
                  ideaName: briefing.idea?.name || "Unnamed Idea",
                  missionName: briefing.idea?.mission?.name,
                  orgName: briefing.idea?.mission?.organization?.name,
                  id: `${briefing.id}-${idx}`,
                  date: briefing.created_at,
                }))
              )
              .slice(0, 6)
              .map((step: any) => (
                <div
                  key={step.id}
                  className="bg-blue-900/10 text-blue-200 border border-blue-800/30 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                    <div className="w-full">
                      <p className="text-sm">{step.step}</p>

                      <div className="flex justify-between items-center mt-3">
                        <p className="text-xs text-blue-400">
                          From: {step.ideaName}
                        </p>
                        <span className="text-xs text-gray-400">
                          {new Date(step.date).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Show mission & org if available */}
                      {(step.missionName || step.orgName) && (
                        <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                          {step.missionName && (
                            <span className="max-w-[100px] truncate">
                              {step.missionName}
                            </span>
                          )}
                          {step.missionName && step.orgName && <span>•</span>}
                          {step.orgName && (
                            <span className="max-w-[100px] truncate">
                              {step.orgName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Chat Button - Fixed position */}
      <button
        onClick={() => setIsChatExpanded(!isChatExpanded)}
        className="fixed bottom-6 right-20 z-50 w-12 h-12 rounded-full bg-green-500/20 text-green-400 border border-green-900 flex items-center justify-center shadow-lg hover:bg-green-500/30 transition-colors"
        aria-label="Toggle knowledge base chat"
        title="Chat with your knowledge base"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Expanded Knowledge Base Chat - Styled like in IdeaDeepDive */}
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
