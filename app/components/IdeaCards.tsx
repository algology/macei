"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lightbulb, Plus } from "lucide-react";
import type { Idea } from "./types";

interface Props {
  missionId: string;
}

export function IdeaCards({ missionId }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIdeas() {
      const { data } = await supabase
        .from("ideas")
        .select("*")
        .eq("mission_id", missionId);

      setIdeas(data || []);
      setLoading(false);
    }

    fetchIdeas();
  }, [missionId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Ideas</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="p-4 border border-accent-2 rounded-lg hover:border-accent-3 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium">{idea.name}</h2>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
