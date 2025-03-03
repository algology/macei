import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Mission } from "./types";

interface Props {
  organizationId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onMissionCreated: (mission: Mission) => void;
}

export function CreateMissionDialog({
  organizationId,
  isOpen,
  onOpenChange,
  onMissionCreated,
}: Props) {
  const [newMissionName, setNewMissionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateMission(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from("missions")
        .insert([
          {
            name: newMissionName,
            organization_id: organizationId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setNewMissionName("");
      onOpenChange(false);
      onMissionCreated(data);
    } catch (error) {
      console.error("Error creating mission:", error);
      alert("Failed to create mission. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-background border border-accent-2 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              Create Mission
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-300">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-400 mb-4">
            Create a new mission to track your objectives and ideas.
          </Dialog.Description>

          <form onSubmit={handleCreateMission}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Mission Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={newMissionName}
                  onChange={(e) => setNewMissionName(e.target.value)}
                  className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? "Creating..." : "Create Mission"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
