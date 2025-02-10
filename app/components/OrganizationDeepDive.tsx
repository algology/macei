import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import { Check } from "lucide-react";

interface Props {
  organizationId: string;
}

interface OrganizationDetails {
  id: number;
  name: string;
  created_at: string;
  description?: string;
  user_id: string;
  missions?: {
    id: number;
    name: string;
  }[];
}

export function OrganizationDeepDive({ organizationId }: Props) {
  const [organization, setOrganization] = useState<OrganizationDetails | null>(
    null
  );
  const [editedOrganization, setEditedOrganization] =
    useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    fetchOrganization();
  }, [organizationId]);

  async function fetchOrganization() {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select(
          `
          *,
          missions (
            id,
            name
          )
        `
        )
        .eq("id", organizationId)
        .single();

      if (error) throw error;
      setOrganization(data);
      setEditedOrganization(data);
    } catch (error) {
      console.error("Error fetching organization:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!organization || !editedOrganization) return;

    try {
      setSaving(true);

      const orgToUpdate = {
        name: editedOrganization.name,
        description: editedOrganization.description,
      };

      const { error } = await supabase
        .from("organizations")
        .update(orgToUpdate)
        .eq("id", organization.id);

      if (error) throw error;

      setOrganization({ ...editedOrganization });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error("Error updating organization:", error);
      alert("Failed to update organization. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    JSON.stringify(organization) !== JSON.stringify(editedOrganization);

  if (loading) return <LoadingSpinner />;
  if (!organization || !editedOrganization)
    return <div>Organization not found</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Organization Details</h2>
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
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={editedOrganization.name}
              onChange={(e) =>
                setEditedOrganization({
                  ...editedOrganization,
                  name: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={editedOrganization.description || ""}
              onChange={(e) =>
                setEditedOrganization({
                  ...editedOrganization,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md min-h-[100px]"
              placeholder="Enter organization description..."
            />
          </div>
        </div>

        {organization.missions && organization.missions.length > 0 && (
          <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Missions</h3>
            <div className="space-y-2">
              {organization.missions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center justify-between p-3 bg-accent-1/30 rounded-lg border border-accent-2"
                >
                  <span>{mission.name}</span>
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
