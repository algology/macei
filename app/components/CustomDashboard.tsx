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
  ideas?: any[];
};

export function CustomDashboard() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedMissions, setCollapsedMissions] = useState<Set<string | number>>(new Set());

  // Chat related state - simplified
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [allIdeasData, setAllIdeasData] = useState<string>("");

  const router = useRouter();

  // Toggle mission collapse state
  const toggleMissionCollapse = (missionId: string | number, e: React.MouseEvent) => {
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
            auto_briefing_enabled,
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
                auto_briefing_enabled: idea.auto_briefing_enabled,
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
      {/* Combined Ideas, Briefings, and Next Steps Section - Full width */}
      <div className="bg-accent-1/30 rounded-xl border border-accent-2 p-6 flex-1 flex flex-col min-h-[70vh]">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-medium">Idea Dashboard</h3>
          </div>
          <button
            onClick={handleCreateIdea}
            className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors hover:shadow-inner flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Idea</span>
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 h-60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading ideas and briefings...</span>
            </div>
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-gray-400 h-60 flex items-center justify-center">
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
          <div className="space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-accent-2 scrollbar-track-transparent pr-1 flex-1">
            {/* Group missions by organization first */}
            {(() => {
              // Create organization map
              const orgMap = new Map();
              
              // Group missions by organization
              ideas.forEach((mission: MissionData) => {
                const orgId = mission.organization?.id || 'unknown';
                const orgName = mission.organization?.name || 'Unknown Organization';
                
                if (!orgMap.has(orgId)) {
                  orgMap.set(orgId, {
                    id: orgId,
                    name: orgName,
                    missions: []
                  });
                }
                
                orgMap.get(orgId).missions.push(mission);
              });
              
              return Array.from(orgMap.values()).map(org => (
                <div key={org.id} className="mb-10">
                  {/* Organization Header */}
                  <div className="flex items-center mb-4 relative">
                    <div className="w-10 h-10 rounded-full bg-accent-1/80 border-2 border-accent-2 flex items-center justify-center text-white font-medium mr-3 relative">
                      {org.name.substring(0, 1).toUpperCase()}
                    </div>
                    <h3 className="text-xl font-bold text-white">{org.name}</h3>
                  </div>
                  
                  {/* Missions under this organization */}
                  <div className="pl-5 space-y-6 relative">
                    {/* Vertical connecting line for all missions under this org - centered on the org avatar */}
                    <div className="absolute w-[1px] bg-gray-600/50 h-full left-5 top-0"></div>
                    
                    {org.missions.map((mission: MissionData) => (
                      <div
                        key={mission.id}
                        className="rounded-lg p-4 bg-accent-1/40 relative"
                      >
                        {/* Horizontal connection line from vertical line to mission circle */}
                        <div className="absolute h-[1px] bg-gray-600/50 w-[15px] top-8" style={{ left: "1px" }}></div>
                        
                        {/* Mission header */}
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
                                <span className="text-blue-300">{mission.name}</span>
                              </h4>
                            </div>
                          </div>
                          
                          {/* Collapse/expand toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{mission.ideas?.length || 0} ideas</span>
                            {collapsedMissions.has(mission.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Ideas list with nested briefings and next steps */}
                        {mission.ideas && mission.ideas.length > 0 && !collapsedMissions.has(mission.id) ? (
                          <div className="pl-4 mt-4 relative">
                            {/* Vertical connecting line for all ideas under this mission - centered on mission avatar */}
                            <div className="absolute w-[1px] bg-gray-600/50 h-full"  />
                            
                            <div className="space-y-4 ml-4">
                              {mission.ideas.map((idea: any) => {
                                // Find the latest briefing for this idea
                                const latestBriefing = briefings.find(
                                  (b) => b.idea_id === idea.id
                                );
                                
                                // Find next steps for this idea
                                const nextSteps = latestBriefing?.next_steps || [];
                                
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
                                    {/* Horizontal connecting line from vertical line to idea circle */}
                                    <div className="absolute h-[1px] bg-gray-600/50 w-[15px] top-7" style={{ left: "-15px" }}></div>
                                    
                                    {/* Idea header and basic info */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-purple-900/30 flex items-center justify-center text-purple-400 text-xs border border-purple-900/50">
                                          <Lightbulb className="w-3 h-3" />
                                        </div>
                                        <h5 className="font-medium text-white flex items-center gap-2">
                                          <span className="text-xs text-gray-400">Idea:</span>
                                          <span>{idea.name}</span>
                                        </h5>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                                            idea.status || "ideation"
                                          )}`}
                                        >
                                          {idea.status || "ideation"}
                                        </span>
                                        
                                        {/* Auto-briefing indicator */}
                                        <span className="ml-1" title={idea.auto_briefing_enabled === false ? "Automatic briefings disabled" : "Automatic briefings enabled"}>
                                          {idea.auto_briefing_enabled === false ? (
                                            <BellOff className="w-3.5 h-3.5 text-gray-400" />
                                          ) : (
                                            <Bell className="w-3.5 h-3.5 text-blue-400" />
                                          )}
                                        </span>
                                      </div>
                                      <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </div>
                                    
                                    {/* Idea description and metadata */}
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
                                            Created: {new Date(idea.created_at).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Latest briefing if available */}
                                      {latestBriefing && (
                                        <div className="mb-3 bg-accent-1/40 rounded-lg p-3 border-l-2 border-purple-500">
                                          <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-4 h-4 text-purple-400" />
                                            <h6 className="text-sm font-medium text-purple-300">Latest Briefing</h6>
                                            <span className="text-xs text-gray-400">
                                              {new Date(latestBriefing.created_at).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-300 line-clamp-2">
                                            {latestBriefing.summary}
                                          </p>
                                        </div>
                                      )}
                                      
                                      {/* Next steps if available */}
                                      {nextSteps.length > 0 && (
                                        <div className="mb-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <ListChecks className="w-4 h-4 text-blue-400" />
                                            <h6 className="text-sm font-medium text-blue-300">Next Steps</h6>
                                          </div>
                                          <ul className="space-y-1 pl-6">
                                            {nextSteps.slice(0, 3).map((step: string, idx: number) => (
                                              <li key={idx} className="text-xs text-gray-300 flex items-start">
                                                <ArrowRight className="w-3 h-3 text-blue-400 mr-1 flex-shrink-0 mt-0.5" />
                                                <span>{step}</span>
                                              </li>
                                            ))}
                                            {nextSteps.length > 3 && (
                                              <li className="text-xs text-gray-400">
                                                +{nextSteps.length - 3} more steps
                                              </li>
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          mission.ideas && mission.ideas.length > 0 && collapsedMissions.has(mission.id) ? (
                            <div className="text-sm text-gray-400 p-3 text-center mt-2">
                              {mission.ideas.length} ideas hidden
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400 p-3 text-center mt-2">
                              No ideas in this mission
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
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
