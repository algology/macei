import * as Popover from "@radix-ui/react-popover";
import { Target, Plus, ChevronDown, Lightbulb } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Mission, Idea } from "./types";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { BreadcrumbItem } from "./types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CreateMissionDialog } from "./CreateMissionDialog";

interface Props {
  organizationId: string;
  onSelect: (mission: Mission) => void;
  selectedMission?: BreadcrumbItem;
}

export function MissionSelector({
  organizationId,
  onSelect,
  selectedMission,
}: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: missionsData } = await supabase
        .from("missions")
        .select("*")
        .eq("organization_id", organizationId);

      setMissions(missionsData || []);

      if (selectedMission) {
        const { data: ideasData } = await supabase
          .from("ideas")
          .select("*")
          .eq("mission_id", selectedMission.id);
        setIdeas(ideasData || []);
      }
    }

    if (organizationId) {
      fetchData();
    }
  }, [organizationId, selectedMission]);

  const handleMissionCreated = (mission: Mission) => {
    setMissions([...missions, mission]);
    onSelect(mission);
  };

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent-1">
            {selectedMission?.icon || <Target className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {selectedMission?.name || "Select Mission"}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="w-80 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
            sideOffset={8}
            align="start"
            alignOffset={-4}
            style={{ zIndex: 100 }}
          >
            <div className="space-y-1">
              {missions.map((mission) => (
                <div key={mission.id} className="space-y-1">
                  <button
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent-1 text-left"
                    onClick={() => {
                      onSelect(mission);
                      setIsOpen(false);
                    }}
                  >
                    <Target className="w-4 h-4" />
                    <span className="text-sm flex-1">{mission.name}</span>
                  </button>
                  {String(selectedMission?.id) === String(mission.id) &&
                    ideas.length > 0 && (
                      <div className="ml-4 pl-4 border-l border-accent-2">
                        {ideas.map((idea) => (
                          <div key={idea.id} className="py-1">
                            <Lightbulb className="w-3 h-3 inline mr-2 text-gray-400" />
                            <span className="text-sm text-gray-400">
                              {idea.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>

            <div className="mt-2 pt-2 border-t border-accent-2">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="w-full text-sm text-green-400 hover:text-green-300 flex items-center justify-center gap-2 p-2"
              >
                <Plus className="w-4 h-4" />
                New Mission
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <CreateMissionDialog
        organizationId={organizationId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onMissionCreated={handleMissionCreated}
      />
    </>
  );
}
