"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lightbulb, Plus } from "lucide-react";
import type { Idea, Mission, Organization } from "./types";
import { CreateIdeaDialog } from "./CreateIdeaDialog";
import { useRouter } from "next/navigation";

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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Ideas</h1>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-green-500/20 text-green-400 text-sm flex items-center gap-2 border border-green-900 hover:bg-green-500/30 rounded-md"
        >
          <Plus className="w-4 h-4" />
          New Idea
        </button>
      </div>

      <div className="w-full border border-gray-800 rounded-lg overflow-hidden bg-[#101618]">
        <div className="grid grid-cols-7 text-xs md:text-sm text-gray-400 bg-gray-900/50">
          <div className="p-2 md:p-3 border-r border-gray-800">
            Organization
          </div>
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
            className="grid grid-cols-7 text-xs md:text-sm border-t border-gray-800 hover:bg-gray-800/30 cursor-pointer"
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
            <div className="p-2 md:p-3 text-gray-400">{idea.signals}</div>
          </div>
        ))}
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
