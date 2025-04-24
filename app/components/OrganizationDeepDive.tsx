import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import { Check } from "lucide-react";
import { Organization, Mission } from "@/app/components/types";

const getConvictionColor = (conviction?: string | null) => {
  switch (conviction) {
    case "Compelling":
      return "bg-green-500/20 text-green-400 border-green-900";
    case "Conditional":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-900";
    case "Postponed":
      return "bg-purple-500/20 text-purple-400 border-purple-900";
    case "Unfeasible":
      return "bg-red-500/20 text-red-400 border-red-900";
    default: // Handles null, undefined, or other values
      return "bg-gray-500/20 text-gray-400 border-gray-900";
  }
};

interface Props {
  organizationId: string;
}

export function OrganizationDeepDive({ organizationId }: Props) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [editedOrganization, setEditedOrganization] =
    useState<Organization | null>(null);
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
            name,
            description,
            ideas (id, conviction)
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
        website_url: editedOrganization.website_url,
        industry: editedOrganization.industry,
        target_market: editedOrganization.target_market,
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

          <div>
            <label className="block text-sm text-gray-400 mb-1">Website URL</label>
            <input
              type="url"
              value={editedOrganization.website_url || ""}
              onChange={(e) =>
                setEditedOrganization({
                  ...editedOrganization,
                  website_url: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Industry</label>
            <input
              type="text"
              value={editedOrganization.industry || ""}
              onChange={(e) =>
                setEditedOrganization({
                  ...editedOrganization,
                  industry: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
              placeholder="e.g., Technology, Healthcare"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Target Market</label>
            <input
              type="text"
              value={editedOrganization.target_market || ""}
              onChange={(e) =>
                setEditedOrganization({
                  ...editedOrganization,
                  target_market: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
              placeholder="e.g., Small Businesses, Consumers"
            />
          </div>
        </div>

        {organization.missions && organization.missions.length > 0 && (
          <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-accent-contrast">Missions</h3>
            <div className="space-y-3">
              {organization.missions.map((mission: Mission) => {
                const convictionCounts: { [key: string]: number } = {
                  Compelling: 0,
                  Conditional: 0,
                  Postponed: 0,
                  Unfeasible: 0,
                  Undetermined: 0, // For null/undefined conviction
                };

                (mission.ideas || []).forEach((idea) => {
                  const conviction = idea.conviction || "Undetermined";
                  if (convictionCounts.hasOwnProperty(conviction)) {
                    convictionCounts[conviction]++;
                  } else {
                    // Should not happen if conviction values are consistent, but handle just in case
                    convictionCounts["Undetermined"]++;
                  }
                });

                // Filter out levels with 0 counts
                const convictionLevelsToShow = Object.entries(convictionCounts)
                  .filter(([level, count]) => count > 0)
                  .sort(([levelA], [levelB]) => {
                    // Optional: Define a sort order if needed
                    const order = [
                      "Compelling",
                      "Conditional",
                      "Postponed",
                      "Unfeasible",
                      "Undetermined",
                    ];
                    return order.indexOf(levelA) - order.indexOf(levelB);
                  });

                return (
                  <div
                    key={mission.id}
                    className="flex items-start justify-between p-3 bg-accent-1/30 rounded-lg border border-accent-2 transition-colors hover:bg-accent-1/50"
                  >
                    {/* Left side: Name and Description */}
                    <div className="flex-grow mr-4">
                      <span className="font-medium text-accent-contrast-dark">
                        {mission.name}
                      </span>
                      {mission.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {mission.description}
                        </p>
                      )}
                    </div>

                    {/* Right side: Conviction breakdown badges */}
                    <div className="flex-shrink-0 flex flex-wrap gap-1.5 items-center justify-end self-center">
                      {convictionLevelsToShow.length > 0 ? (
                        convictionLevelsToShow.map(([level, count]) => (
                          <span
                            key={level}
                            title={`${count} ${level} ${count === 1 ? 'idea' : 'ideas'}`}
                            // Make badges slightly wider to accommodate text
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] border ${getConvictionColor(level === "Undetermined" ? null : level)}`}
                          >
                            <span className="font-medium">{count}</span>
                            {/* Add the level text */}
                            <span className="whitespace-nowrap">
                              {level === "Undetermined" ? "TBD" : level}
                              {/* Add Idea/Ideas */}
                              {` ${count === 1 ? 'Idea' : 'Ideas'}`}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500 italic">No ideas</span>
                      )}
                    </div>
                  </div>
                );
              })}
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
