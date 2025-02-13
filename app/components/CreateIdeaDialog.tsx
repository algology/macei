import * as Dialog from "@radix-ui/react-dialog";
import { X, Wand2, Plus, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Idea } from "./types";

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
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [impact, setImpact] = useState<"High" | "Medium" | "Low">("Medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());

  // Reset all states when dialog opens/closes
  useEffect(() => {
    setName("");
    setCategory("");
    setImpact("Medium");
    setAiSuggestions([]);
    setIsGenerating(false);
    setSelectedIdeas(new Set());
  }, [isOpen]);

  async function generateIdeas() {
    try {
      setIsGenerating(true);

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

      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: missionData?.organization?.name,
          mission: missionData?.name,
          mission_description: missionData?.description,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Ensure we're working with a stable JSON structure
      const parsedContent =
        typeof data.content === "string"
          ? JSON.parse(data.content)
          : data.content;

      setAiSuggestions(parsedContent.ideas || []);
    } catch (error) {
      console.error("Error generating ideas:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCreate(ideaData: any = null) {
    try {
      const ideaToCreate = ideaData
        ? {
            name: ideaData.name,
            category: ideaData.category || "Unspecified",
            impact: ideaData.impact || "Medium",
            mission_id: parseInt(missionId, 10),
            status: "ideation",
            signals: ideaData.signals || "",
            description: ideaData.description || "",
          }
        : {
            name,
            category,
            impact,
            mission_id: parseInt(missionId, 10),
            status: "ideation",
            signals: "",
            description: "",
          };

      const { data, error } = await supabase
        .from("ideas")
        .insert([ideaToCreate])
        .select()
        .single();

      if (error) {
        console.error("Error creating idea:", error);
        return;
      }

      onIdeaCreated(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error in handleCreate:", error);
    }
  }

  async function handleCreateMultiple() {
    try {
      const selectedIdeaData = aiSuggestions.filter((_, index) =>
        selectedIdeas.has(index)
      );

      for (const ideaData of selectedIdeaData) {
        const ideaToCreate = {
          name: ideaData.name,
          category: ideaData.category || "Unspecified",
          impact: ideaData.impact || "Medium",
          mission_id: parseInt(missionId, 10),
          status: "ideation",
          signals: ideaData.signals || "",
          description: ideaData.description || "",
        };

        const { data, error } = await supabase
          .from("ideas")
          .insert([ideaToCreate])
          .select()
          .single();

        if (error) {
          console.error("Error creating idea:", error);
          continue;
        }

        onIdeaCreated(data);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error in handleCreateMultiple:", error);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background border border-accent-2 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-xl font-semibold">
              Create New Idea
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-300">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {aiSuggestions.length === 0 ? (
            <>
              <div className="space-y-4 mb-6">
                <button
                  onClick={generateIdeas}
                  disabled={isGenerating}
                  className="w-full px-4 py-3 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1 transition-colors flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  {isGenerating
                    ? "Generating ideas..."
                    : "Generate AI Suggestions"}
                </button>

                <div className="text-center text-sm text-gray-400 my-4">
                  or create manually
                </div>

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
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="category"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Category
                    </label>
                    <input
                      id="category"
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="impact"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Impact
                    </label>
                    <div className="relative">
                      <select
                        id="impact"
                        value={impact}
                        onChange={(e) =>
                          setImpact(e.target.value as "High" | "Medium" | "Low")
                        }
                        className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20 appearance-none"
                        required
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleCreate()}
                  disabled={!name}
                  className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Create Idea
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={generateIdeas}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1 transition-colors flex items-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  {isGenerating ? "Generating more..." : "Generate More"}
                </button>

                <button
                  onClick={handleCreateMultiple}
                  disabled={selectedIdeas.size === 0}
                  className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Save Selected ({selectedIdeas.size})
                </button>
              </div>

              <div className="space-y-4">
                {aiSuggestions.map((idea, index) => (
                  <div
                    key={index}
                    className={`p-4 bg-accent-1/50 border rounded-lg transition-colors cursor-pointer ${
                      selectedIdeas.has(index)
                        ? "border-green-500 bg-green-500/10"
                        : "border-accent-2 hover:border-green-500/50"
                    }`}
                    onClick={() => {
                      const newSelected = new Set(selectedIdeas);
                      if (selectedIdeas.has(index)) {
                        newSelected.delete(index);
                      } else {
                        newSelected.add(index);
                      }
                      setSelectedIdeas(newSelected);
                    }}
                  >
                    <h3 className="font-medium mb-2">{idea.name}</h3>
                    <p className="text-sm text-gray-400 mb-2">
                      {idea.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-accent-1 rounded-md text-gray-400">
                        {idea.category}
                      </span>
                      <span className="px-2 py-1 bg-accent-1 rounded-md text-gray-400">
                        {idea.impact} Impact
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
