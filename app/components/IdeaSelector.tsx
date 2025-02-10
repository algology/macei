import * as Popover from "@radix-ui/react-popover";
import { Lightbulb, Plus, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Idea } from "./types";
import type { BreadcrumbItem } from "./types";
import { CreateIdeaDialog } from "./CreateIdeaDialog";

interface Props {
  missionId: string;
  onSelect: (idea: Idea) => void;
  selectedIdea?: BreadcrumbItem;
}

export function IdeaSelector({ missionId, onSelect, selectedIdea }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const handleIdeaCreated = (idea: Idea) => {
    setIdeas([...ideas, idea]);
    // Don't call onSelect here since we're in the selector
    // Just close the dialog and update the list
    setIsDialogOpen(false);
  };

  return (
    <>
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
            className="w-64 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
            sideOffset={8}
            align="start"
            alignOffset={0}
            style={{ zIndex: 100 }}
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
              <button
                onClick={() => setIsDialogOpen(true)}
                className="w-full text-sm text-green-400 hover:text-green-300 flex items-center justify-center gap-2 p-2"
              >
                <Plus className="w-4 h-4" />
                New Idea
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <CreateIdeaDialog
        missionId={missionId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onIdeaCreated={handleIdeaCreated}
      />
    </>
  );
}
