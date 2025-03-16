import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Idea } from "./types";
import { IdeaAttributesDialog } from "./IdeaAttributesDialog";

interface Props {
  missionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onIdeaCreated: (idea: Idea) => void;
}

export function CreateIdeaDialog({
  missionId,
  isOpen,
  onOpenChange,
  onIdeaCreated,
}: Props) {
  const [newIdeaName, setNewIdeaName] = useState("");
  const [ideaSummary, setIdeaSummary] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showAttributesDialog, setShowAttributesDialog] = useState(false);
  const [createdIdea, setCreatedIdea] = useState<Idea | null>(null);

  async function handleCreateIdea(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from("ideas")
        .insert([
          {
            name: newIdeaName,
            mission_id: missionId,
            summary: ideaSummary,
            status: "ideation",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setCreatedIdea(data);
      setShowAttributesDialog(true);
      setNewIdeaName("");
      setIdeaSummary("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating idea:", error);
      alert("Failed to create idea. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  const handleAttributesComplete = () => {
    if (createdIdea) {
      onIdeaCreated(createdIdea);
    }
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] bg-background border border-accent-2 rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">
                Create New Idea
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-300">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <Dialog.Description className="text-sm text-gray-400 mb-4">
              Create a new idea to track and validate.
            </Dialog.Description>

            <form onSubmit={handleCreateIdea}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Idea Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newIdeaName}
                    onChange={(e) => setNewIdeaName(e.target.value)}
                    className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    autoComplete="off"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="summary"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Idea Summary
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    Write a brief summary of the Idea, based on what you know
                    about the Idea right now. This may include the problem
                    you're facing, the opportunity, the strategic alignment, or
                    even the desired outcome. We will use this background to
                    identify the key attributes of the Idea begin building the
                    right signals.
                  </p>
                  <textarea
                    id="summary"
                    value={ideaSummary}
                    onChange={(e) => setIdeaSummary(e.target.value)}
                    className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20 min-h-[120px]"
                    placeholder="Enter your idea summary..."
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? "Creating..." : "Create Idea"}
                  </button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {createdIdea && (
        <IdeaAttributesDialog
          idea={createdIdea}
          isOpen={showAttributesDialog}
          onOpenChange={setShowAttributesDialog}
          onComplete={handleAttributesComplete}
        />
      )}
    </>
  );
}
