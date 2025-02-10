import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import { Check } from "lucide-react";

interface Props {
  missionId: string;
}

interface MissionDetails {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  organization_id: number;
  organization?: {
    id: number;
    name: string;
  };
  ideas?: {
    id: number;
    name: string;
    status: string;
  }[];
}

export function MissionDeepDive({ missionId }: Props) {
  const [mission, setMission] = useState<MissionDetails | null>(null);
  const [editedMission, setEditedMission] = useState<MissionDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    fetchMission();
  }, [missionId]);

  async function fetchMission() {
    try {
      const { data, error } = await supabase
        .from("missions")
        .select(
          `
          *,
          organization:organizations (
            id,
            name
          ),
          ideas (
            id,
            name,
            status
          )
        `
        )
        .eq("id", missionId)
        .single();

      if (error) throw error;
      setMission(data);
      setEditedMission(data);
    } catch (error) {
      console.error("Error fetching mission:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!mission || !editedMission) return;

    try {
      setSaving(true);

      const missionToUpdate = {
        name: editedMission.name,
        description: editedMission.description,
      };

      const { error } = await supabase
        .from("missions")
        .update(missionToUpdate)
        .eq("id", mission.id);

      if (error) throw error;

      setMission({ ...editedMission });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error("Error updating mission:", error);
      alert("Failed to update mission. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = JSON.stringify(mission) !== JSON.stringify(editedMission);

  if (loading) return <LoadingSpinner />;
  if (!mission || !editedMission) return <div>Mission not found</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Mission Details</h2>
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

      <div className="space-y-6">
        <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={mission.organization?.name || ""}
              disabled
              className="w-full px-3 py-2 bg-accent-1/50 border border-accent-2 rounded-md text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={editedMission.name}
              onChange={(e) =>
                setEditedMission({ ...editedMission, name: e.target.value })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={editedMission.description || ""}
              onChange={(e) =>
                setEditedMission({
                  ...editedMission,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md min-h-[100px]"
              placeholder="Enter mission description..."
            />
          </div>
        </div>

        {mission.ideas && mission.ideas.length > 0 && (
          <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Ideas</h3>
            <div className="space-y-2">
              {mission.ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="flex items-center justify-between p-3 bg-accent-1/30 rounded-lg border border-accent-2"
                >
                  <span>{idea.name}</span>
                  <span className="text-sm text-gray-400">{idea.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSaved && (
        <div className="fixed bottom-4 right-4 bg-green-900 text-green-400 px-4 py-2 rounded-md border border-green-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Changes saved
        </div>
      )}
    </div>
  );
}
