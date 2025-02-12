"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lightbulb, Plus, MoreHorizontal, Trash2 } from "lucide-react";
import type { Idea, Mission, Organization } from "./types";
import { CreateIdeaDialog } from "./CreateIdeaDialog";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface Props {
  missionId: string;
}

interface ExtendedIdea
  extends Omit<Idea, "status" | "category" | "impact" | "signals"> {
  organization?: Organization;
  mission?: Mission;
  status: "validated" | "in review" | "ideation";
  category: string;
  impact: "High" | "Medium" | "Low";
  signals: string;
}

export function IdeaCards({ missionId }: Props) {
  const [ideas, setIdeas] = useState<ExtendedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchIdeas() {
      const { data: missionData } = await supabase
        .from("missions")
        .select(
          `
          *,
          organization:organizations(*)
        `
        )
        .eq("id", missionId)
        .single();

      const { data: ideasData } = await supabase
        .from("ideas")
        .select("*")
        .eq("mission_id", missionId);

      const extendedIdeas = (ideasData || []).map((idea) => ({
        ...idea,
        organization: missionData?.organization,
        mission: missionData,
        // Default values for required fields
        category: idea.category || "Unspecified",
        impact: idea.impact || "Medium",
        status: idea.status || "ideation",
        signals: idea.signals || "No signals yet",
      }));

      setIdeas(extendedIdeas);
      setLoading(false);
    }

    fetchIdeas();
  }, [missionId]);

  const handleIdeaCreated = (idea: Idea) => {
    const extendedIdea: ExtendedIdea = {
      ...idea,
      organization: ideas[0]?.organization,
      mission: ideas[0]?.mission,
      category: "Unspecified",
      impact: "Medium",
      status: "ideation",
      signals: "No signals yet",
    };
    setIdeas([...ideas, extendedIdea]);
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

  async function handleDelete(ideaId: number) {
    try {
      const { error } = await supabase
        .from("ideas")
        .delete()
        .eq("id", ideaId);

      if (error) throw error;

      setIdeas(ideas.filter((idea) => idea.id !== ideaId));
    } catch (error) {
      console.error("Error deleting idea:", error);
      alert("Failed to delete idea. Please try again.");
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Ideas</h1>
      </div>

      <div className="w-full border border-gray-800 rounded-lg overflow-hidden bg-[#101618]">
        <div className="grid grid-cols-7 text-xs md:text-sm text-gray-400 bg-gray-900/50">
          <div className="p-2 md:p-3 border-r border-gray-800">Organization</div>
          <div className="p-2 md:p-3 border-r border-gray-800">Mission</div>
          <div className="p-2 md:p-3 border-r border-gray-800">Idea</div>
          <div className="p-2 md:p-3 border-r border-gray-800">Status</div>
          <div className="p-2 md:p-3 border-r border-gray-800">Category</div>
          <div className="p-2 md:p-3 border-r border-gray-800">Impact</div>
          <div className="p-2 md:p-3">Signals</div>
        </div>

        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="grid grid-cols-7 text-xs md:text-sm border-t border-gray-800 hover:bg-gray-800/30 cursor-pointer group"
            onClick={() =>
              router.push(
                `/dashboard/org/${idea.organization?.id}/mission/${idea.mission_id}/idea/${idea.id}`
              )
            }
          >
            <div className="p-2 md:p-3 border-r border-gray-800 text-gray-400">
              {idea.organization?.name}
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800 text-gray-400">
              {idea.mission?.name}
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800 text-gray-200">
              {idea.name}
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800">
              <span
                className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs border ${getStatusColor(
                  idea.status || "ideation"
                )}`}
              >
                {idea.status}
              </span>
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800 text-gray-400">
              {idea.category}
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800 text-gray-400">
              {idea.impact}
            </div>
            <div className="p-2 md:p-3 text-gray-400 relative">
              {idea.signals ? (
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    try {
                      const signals = JSON.parse(idea.signals);

                      if (Array.isArray(signals)) {
                        return signals.map((signal: unknown, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full"
                          >
                            {String(signal)}
                          </span>
                        ));
                      } else if (
                        typeof signals === "object" &&
                        signals !== null
                      ) {
                        return Object.values(signals as Record<string, unknown>)
                          .flat()
                          .map((signal: unknown, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full"
                            >
                              {String(signal)}
                            </span>
                          ));
                      } else if (typeof signals === "string") {
                        return (
                          <span className="inline-flex items-center bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full">
                            {signals}
                          </span>
                        );
                      }
                      return (
                        <span className="text-gray-500">Invalid format</span>
                      );
                    } catch (e) {
                      return idea.signals
                        .split(",")
                        .map((signal: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full"
                          >
                            {signal.trim()}
                          </span>
                        ));
                    }
                  })()}
                </div>
              ) : (
                <span className="text-gray-500">No signals</span>
              )}
              
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-700/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="w-48 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95">
                    <DropdownMenu.Item
                      onSelect={() => handleDelete(idea.id)}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-accent-1 rounded-md outline-none cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        ))}

        <div 
          className="grid grid-cols-7 text-xs md:text-sm border-t border-gray-800 hover:bg-gray-800/30 cursor-pointer group"
          onClick={() => setIsDialogOpen(true)}
        >
          <div className="col-span-7 p-3 flex items-center justify-center">
            <div className="p-2 rounded-full hover:bg-gray-700/50 transition-colors">
              <Plus className="w-5 h-5 text-gray-400 group-hover:text-gray-200" />
            </div>
          </div>
        </div>
      </div>

      <CreateIdeaDialog
        missionId={missionId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onIdeaCreated={handleIdeaCreated}
      />
    </div>
  );
}
