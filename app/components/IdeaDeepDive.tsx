import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import { Check } from "lucide-react";

interface Props {
  ideaId: string;
}

interface IdeaDetails {
  id: number;
  name: string;
  status: "validated" | "in review" | "ideation";
  category: string;
  impact: "High" | "Medium" | "Low";
  signals: string;
  created_at: string;
}

const defaultIdea: IdeaDetails = {
  id: 0,
  name: "",
  status: "ideation",
  category: "",
  impact: "Medium",
  signals: "",
  created_at: "",
};

export function IdeaDeepDive({ ideaId }: Props) {
  const [idea, setIdea] = useState<IdeaDetails | null>(null);
  const [editedIdea, setEditedIdea] = useState<IdeaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    fetchIdea();
  }, [ideaId]);

  async function fetchIdea() {
    try {
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .eq("id", ideaId)
        .single();

      if (error) throw error;
      setIdea(data);
      setEditedIdea(data);
    } catch (error) {
      console.error("Error fetching idea:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!idea || !editedIdea) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("ideas")
        .update(editedIdea)
        .eq("id", idea.id);

      if (error) throw error;

      // Update local state
      setIdea(editedIdea);

      // Show success indicator
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error("Error updating idea:", error);
      alert("Failed to update idea. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = JSON.stringify(idea) !== JSON.stringify(editedIdea);

  if (loading) return <LoadingSpinner />;
  if (!idea || !editedIdea) return <div>Idea not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Idea Details</h2>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-4 py-2 rounded-md text-sm flex items-center gap-2 ${
            hasChanges
              ? "bg-green-500/20 text-green-400 border border-green-900 hover:bg-green-500/30"
              : "bg-gray-500/20 text-gray-400 border border-gray-800 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={editedIdea.name}
            onChange={(e) =>
              setEditedIdea({ ...editedIdea, name: e.target.value })
            }
            className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            value={editedIdea.status}
            onChange={(e) =>
              setEditedIdea({
                ...editedIdea,
                status: e.target.value as IdeaDetails["status"],
              })
            }
            className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
          >
            <option value="ideation">Ideation</option>
            <option value="in review">In Review</option>
            <option value="validated">Validated</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <input
            type="text"
            value={editedIdea.category || ""}
            onChange={(e) =>
              setEditedIdea({ ...editedIdea, category: e.target.value })
            }
            className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Impact</label>
          <select
            value={editedIdea.impact || "Medium"}
            onChange={(e) =>
              setEditedIdea({
                ...editedIdea,
                impact: e.target.value as IdeaDetails["impact"],
              })
            }
            className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Signals</label>
          <textarea
            value={editedIdea.signals || ""}
            onChange={(e) =>
              setEditedIdea({ ...editedIdea, signals: e.target.value })
            }
            className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md min-h-[100px]"
          />
        </div>
      </div>

      {showSaved && (
        <div className="fixed bottom-4 right-4 bg-green-500/20 text-green-400 px-4 py-2 rounded-md border border-green-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Changes saved
        </div>
      )}
    </div>
  );
}
