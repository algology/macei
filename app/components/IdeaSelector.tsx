import * as Popover from "@radix-ui/react-popover";
import { Lightbulb, Plus, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Idea } from "./types";
import type { BreadcrumbItem } from "./types";

interface Props {
  missionId: string;
  onSelect: (idea: Idea) => void;
  selectedIdea?: BreadcrumbItem;
}

export function IdeaSelector({ missionId, onSelect, selectedIdea }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchIdeas() {
      const { data } = await supabase
        .from("ideas")
        .select("*")
        .eq("mission_id", missionId);

      setIdeas(data || []);
    }

    if (missionId) {
      fetchIdeas();
    }
  }, [missionId]);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent-1">
          {selectedIdea?.icon || <Lightbulb className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {selectedIdea?.name || "Select Idea"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-[300px] bg-background border border-accent-2 rounded-lg shadow-lg p-2 animate-in fade-in-0 zoom-in-95"
          sideOffset={5}
        >
          <div className="space-y-1">
            {ideas.map((idea) => (
              <button
                key={idea.id}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent-1 text-left"
                onClick={() => {
                  onSelect?.(idea);
                  setIsOpen(false);
                }}
              >
                <Lightbulb className="w-4 h-4" />
                <span className="text-sm flex-1">{idea.name}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-accent-2 mt-2 pt-2">
            <button className="w-full text-sm text-green-400 hover:text-green-300 flex items-center justify-center gap-2 p-2">
              <Plus className="w-4 h-4" />
              New Idea
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
