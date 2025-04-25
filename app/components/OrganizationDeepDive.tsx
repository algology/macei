"use client";

import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase'; // Import the configured client instance
import { LoadingSpinner } from "./LoadingSpinner";
import { Check, AlertTriangle } from "lucide-react";
import { Organization as OrganizationType, Mission, Profile } from "@/app/components/types";
import { User } from "@supabase/supabase-js"; 
import { MoreVertical, Trash2, UserCog } from 'lucide-react'; 
import { useRouter } from 'next/navigation';

// TODO: Generate database types using `npx supabase gen types typescript --project-id <your-project-id> --schema public > lib/database.types.ts`

type MemberRole = 'owner' | 'editor' | 'viewer'; // Consider moving to types.ts if used elsewhere

// Define a more specific type for the combined member data
// Using 'any' for now until Database types are generated
type OrganizationMemberWithProfile = any & { 
  profiles: Profile | null; // Explicitly add profiles type
  // Add users if needed later, fetched separately
};

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
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-900";
  }
};

interface Props {
  organizationId: string;
}

export function OrganizationDeepDive({ organizationId }: Props) {
  const [organization, setOrganization] = useState<OrganizationType | null>(null);
  const [editedOrganization, setEditedOrganization] =
    useState<OrganizationType | null>(null);
  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null); 
  const [inviteEmail, setInviteEmail] = useState(""); // State for invite email input
  const [isInviting, setIsInviting] = useState(false); // State for invitation loading
  const [managingMemberId, setManagingMemberId] = useState<string | null>(null); // Track which member's dropdown is open
  const [isDeleting, setIsDeleting] = useState(false); // State for deletion loading
  const router = useRouter(); // Initialize router

  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
    };
    fetchUser();

    fetchOrganizationAndMembers(); 
  }, [organizationId]);

  async function fetchOrganizationAndMembers() {
    setLoading(true);
    if (!organizationId) {
        console.error("Organization ID is missing.");
        setLoading(false);
        return;
    }
    try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("User not authenticated");

        // 1. Fetch Organization Details
        const orgPromise = supabase
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

        // 2. Fetch Member IDs and Roles
        const membersBasePromise = supabase
            .from('organization_members')
            .select('user_id, role') // Only fetch user_id and role initially
            .eq('organization_id', organizationId);

        // 3. Fetch Current User's Role
        const currentUserRolePromise = supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', authUser.id)
            .maybeSingle();

        // Await initial fetches
        const [
            { data: orgData, error: orgError },
            { data: membersBaseData, error: membersBaseError },
            { data: roleData, error: roleError }
        ] = await Promise.all([orgPromise, membersBasePromise, currentUserRolePromise]);

        if (orgError) throw orgError;
        if (membersBaseError) {
            console.error("Error fetching base members data:", membersBaseError);
            throw membersBaseError;
        }
        if (roleError) throw roleError;

        setOrganization(orgData);
        setEditedOrganization(orgData);
        setCurrentUserRole(roleData?.role || null);

        // 4. Fetch Profiles using Member IDs if members exist
        let profilesData: Profile[] | null = [];
        const memberUserIds = membersBaseData?.map(m => m.user_id) || [];

        if (memberUserIds.length > 0) {
            const { data: fetchedProfilesData, error: profilesError } = await supabase
                .from('profiles') // Fetch from profiles table
                .select('*') // Select all profile fields
                .in('id', memberUserIds); // Where profile ID matches member user_ids

            if (profilesError) {
                console.error("Error fetching profiles:", profilesError);
                // Decide how to handle profile fetch error - maybe proceed without profiles?
                profilesData = []; // Set to empty array on error
            } else {
                profilesData = fetchedProfilesData as Profile[];
            }
        }

        // 5. Combine Member base data with Profile data
        const combinedMembers = (membersBaseData || []).map(memberBase => {
            const profile = profilesData?.find(p => p.id === memberBase.user_id) || null;
            return {
                ...memberBase,
                profiles: profile // Add the found profile (or null)
            };
        });

        setMembers(combinedMembers as OrganizationMemberWithProfile[]);

    } catch (error) {
        console.error("Error fetching organization data:", error);
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

  async function handleInviteMember() {
    if (!inviteEmail || !organizationId || !canManageMembers) return;

    setIsInviting(true);
    try {
      const trimmedEmail = inviteEmail.trim();
      const res = await fetch('/api/organization-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId, email: trimmedEmail, role: 'viewer' }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `HTTP ${res.status}`);
      }
      alert(`User ${trimmedEmail} invited successfully as a viewer.`);
      setInviteEmail('');
      fetchOrganizationAndMembers();
    } catch (error) {
      console.error('Error inviting member:', error);
      alert(`Failed to invite member. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsInviting(false);
    }
  }

  async function handleUpdateMemberRole(userId: string, newRole: MemberRole) {
      if (!canManageMembers || !organizationId || userId === currentUser?.id) {
          console.warn("Permission denied or invalid operation for updating role.");
          setManagingMemberId(null); // Close dropdown
          return; // Prevent owners/editors editing themselves via this basic handler for now
      }

      // Add basic confirmation
      const confirmation = window.confirm(`Are you sure you want to change this member's role to ${newRole}?`);
      if (!confirmation) {
          setManagingMemberId(null); // Close dropdown if cancelled
          return;
      }

      console.log(`Attempting: Update user ${userId} to role ${newRole} in org ${organizationId}`);
      try {
          const { error } = await supabase
            .from('organization_members')
            .update({ role: newRole })
            .eq('organization_id', organizationId)
            .eq('user_id', userId);

          if (error) throw error;

          // Success: Refresh list, close dropdown, show feedback
          alert(`Member role updated to ${newRole}.`);
          fetchOrganizationAndMembers(); // Refresh

      } catch (error) {
           console.error("Error updating member role:", error);
           alert(`Failed to update role. Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
           setManagingMemberId(null); // Ensure dropdown closes
      }
  }

  async function handleRemoveMember(userId: string, userEmail: string | undefined) {
       if (!canManageMembers || !organizationId || userId === currentUser?.id) {
          console.warn("Permission denied or invalid operation for removing member.");
           setManagingMemberId(null); // Close dropdown
          return; // Prevent self-removal here
      }

      // Confirmation dialog
      const confirmation = window.confirm(`Are you sure you want to remove ${userEmail || 'this user'} from the organization? This action cannot be undone.`);
      if (!confirmation) {
          setManagingMemberId(null); // Close dropdown if cancelled
          return;
      }

      console.log(`Attempting: Remove user ${userId} from org ${organizationId}`);
      try {
          const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('organization_id', organizationId)
            .eq('user_id', userId);

          if (error) throw error;

          // Success: Refresh list, close dropdown, show feedback
          alert(`${userEmail || 'Member'} removed successfully.`);
          fetchOrganizationAndMembers(); // Refresh

      } catch (error) {
          console.error("Error removing member:", error);
          alert(`Failed to remove member. Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
           setManagingMemberId(null); // Ensure dropdown closes
      }
  }

  async function handleDeleteOrganization() {
    if (!organization || currentUserRole !== 'owner' || isDeleting) {
      return;
    }

    const confirm1 = window.confirm(
      `DANGER ZONE: Are you absolutely sure you want to delete the organization "${organization.name}"? This action is irreversible and will delete all associated missions and ideas.`
    );

    if (!confirm1) return;

    const confirm2 = prompt(
      `To confirm deletion, please type the organization name: "${organization.name}"`
    );

    if (confirm2 !== organization.name) {
      alert("Organization name did not match. Deletion cancelled.");
      return;
    }

    setIsDeleting(true);
    try {
      console.log(`Attempting to delete organization: ${organization.id} (${organization.name})`);
      
      // --- Deletion Logic --- 
      // IMPORTANT: This is a basic direct delete. 
      // For production, using a Supabase Edge Function (RPC) is highly recommended 
      // to handle cascading deletes (missions, ideas, members, etc.) within a transaction.
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id);

      if (error) {
        throw error;
      }

      alert(`Organization "${organization.name}" deleted successfully.`);
      router.push('/dashboard'); // Redirect after successful deletion
      // Consider router.refresh() if staying on a page that needs updated data

    } catch (error) {
      console.error("Error deleting organization:", error);
      alert(`Failed to delete organization. Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  }

  const hasChanges =
    JSON.stringify(organization) !== JSON.stringify(editedOrganization);

  if (loading) return <LoadingSpinner />;
  if (!organization || !editedOrganization)
    return <div>Organization not found</div>;

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'editor';

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
                  Undetermined: 0, 
                };

                (mission.ideas || []).forEach((idea) => {
                  const conviction = idea.conviction || "Undetermined";
                  if (convictionCounts.hasOwnProperty(conviction)) {
                    convictionCounts[conviction]++;
                  } else {
                    convictionCounts["Undetermined"]++;
                  }
                });

                const convictionLevelsToShow = Object.entries(convictionCounts)
                  .filter(([level, count]) => count > 0)
                  .sort(([levelA], [levelB]) => {
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

                    <div className="flex-shrink-0 flex flex-wrap gap-1.5 items-center justify-end self-center">
                      {convictionLevelsToShow.length > 0 ? (
                        convictionLevelsToShow.map(([level, count]) => (
                          <span
                            key={level}
                            title={`${count} ${level} ${count === 1 ? 'idea' : 'ideas'}`}
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] border ${getConvictionColor(level === "Undetermined" ? null : level)}`}
                          >
                            <span className="font-medium">{count}</span>
                            <span className="whitespace-nowrap">
                              {level === "Undetermined" ? "TBD" : level}
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

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Members</h3>
        {canManageMembers && (
          <div className="p-4 bg-accent-1/50 border border-accent-2 rounded-lg space-y-3">
            <label className="block text-sm text-gray-400 mb-1">Invite New Member</label>
            <div className="flex gap-2 items-center">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter user email"
                className="flex-grow px-3 py-2 bg-accent-1 border border-accent-2 rounded-md text-sm disabled:opacity-50"
                disabled={isInviting}
              />
              <button
                onClick={handleInviteMember}
                disabled={!inviteEmail.trim() || isInviting} // Disable if email is empty or inviting
                className={`px-3 py-2 w-[80px] h-[38px] rounded-md text-sm flex items-center justify-center transition-colors ${ // Fixed width for button
                  !inviteEmail.trim() || isInviting
                  ? 'bg-gray-500/20 text-gray-400 border border-gray-800 cursor-not-allowed'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-900 hover:bg-blue-500/30'
                }`}
              >
                {isInviting ? <LoadingSpinner className="w-4 h-4"/> : 'Invite'}
              </button>
            </div>
            {/* Note: Assumes 'profiles' table has an 'email' column accessible via RLS. */}
            {/* Consider using an RPC function for robustness. */}
          </div>
        )}
        <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6 space-y-4">
          {members.length === 0 ? (
            <p className="text-gray-400">No members found for this organization.</p>
          ) : (
            <ul className="space-y-3">
              {members.map((member) => (
                <li key={member.user_id} className="flex justify-between items-center p-3 bg-accent-1 rounded-md border border-accent-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm overflow-hidden">
                      {member.profiles?.avatar_url ? (
                        <img src={member.profiles.avatar_url} alt={member.profiles.full_name || 'Avatar'} className="w-full h-full object-cover" />
                      ) : (
                        member.profiles?.full_name?.charAt(0) || '?'
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {member.profiles?.full_name || 'No Name Provided'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-900 capitalize">
                      {member.role}
                    </span>
                    {canManageMembers && member.user_id !== currentUser?.id && (
                      <div className="relative">
                        <button
                          onClick={() => setManagingMemberId(managingMemberId === member.user_id ? null : member.user_id)}
                          className="text-gray-400 hover:text-white p-1 rounded hover:bg-accent-2"
                          aria-label={`Manage ${member.profiles?.full_name || 'Member'}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {/* Basic Dropdown */}
                        {managingMemberId === member.user_id && (
                          <div className="absolute right-0 mt-2 w-48 bg-background border border-accent-2 rounded-lg shadow-lg z-10 p-1 animate-in fade-in-0 zoom-in-95">
                            <div className="px-2 py-1.5 text-xs text-gray-400 border-b border-accent-2 mb-1">Change Role</div>
                            {['owner', 'editor', 'viewer'].map((role) => (
                              <button
                                key={role}
                                onClick={() => handleUpdateMemberRole(member.user_id, role as MemberRole)}
                                disabled={member.role === role} // Disable current role
                                className={`w-full text-left px-2 py-1.5 text-sm flex items-center gap-2 rounded-md outline-none cursor-pointer ${
                                  member.role === role
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : 'text-gray-400 hover:bg-accent-1 hover:text-gray-300'
                                }`}
                              >
                                <UserCog size={14} className="opacity-70"/>
                                <span className="capitalize">{role}</span>
                                {member.role === role && <Check size={14} className="ml-auto text-green-500"/>}
                              </button>
                            ))}
                            <div className="border-t border-accent-2 mt-1 pt-1">
                              <button
                                onClick={() => handleRemoveMember(member.user_id, member.profiles?.full_name || 'Member')}
                                className="w-full text-left px-2 py-1.5 text-sm flex items-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md outline-none cursor-pointer"
                              >
                                <Trash2 size={14} className="opacity-70"/>
                                Remove Member
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {member.user_id === currentUser?.id && (
                      <span className="text-xs text-green-400">(You)</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Danger Zone - Only visible to owners */} 
      {currentUserRole === 'owner' && (
        <div className="mt-12 pt-8 border-t border-red-900/50">
          <h3 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </h3>
          <div className="bg-red-900/20 border border-red-900/60 rounded-lg p-6 space-y-4">
            <div>
              <h4 className="font-medium text-red-300">Delete this organization</h4>
              <p className="text-sm text-red-400/80 mt-1 mb-3">
                Once you delete an organization, there is no going back. All associated data, including missions and ideas, will be permanently deleted. Please be certain.
              </p>
              <button
                onClick={handleDeleteOrganization}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2 w-full sm:w-auto transition-colors ${ 
                  isDeleting
                  ? 'bg-gray-500/20 text-gray-400 border border-gray-800 cursor-not-allowed'
                  : 'bg-red-500/20 text-red-300 border border-red-900 hover:bg-red-500/30 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-background outline-none'
                }`}
              >
                {isDeleting ? <LoadingSpinner className="w-4 h-4"/> : 'Delete Organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaved && (
        <div className="fixed bottom-4 right-4 bg-green-900 text-green-400 px-4 py-2 rounded-md border border-green-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Changes saved
        </div>
      )}
    </div>
  );
}
