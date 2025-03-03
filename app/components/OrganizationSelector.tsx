import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { Building2, Plus, ChevronDown, X, Target } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Organization } from "./types";
import type { BreadcrumbItem } from "./types";
import type { Mission } from "./types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface Props {
  onSelect: (org: Organization) => void;
  selectedOrg?: BreadcrumbItem;
}

export function OrganizationSelector({ onSelect, selectedOrg }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrgState, setSelectedOrgState] = useState<Organization | null>(
    null
  );

  useEffect(() => {
    async function fetchData() {
      const { data: orgs } = await supabase.from("organizations").select("*");
      setOrganizations(orgs || []);

      if (selectedOrg) {
        const { data: missionData } = await supabase
          .from("missions")
          .select("*")
          .eq("organization_id", selectedOrg.id);
        setMissions(missionData || []);
      }
    }
    fetchData();
  }, [selectedOrg]);

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) return;

      const { data, error } = await supabase
        .from("organizations")
        .insert([
          {
            name: newOrgName,
            user_id: session.user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setOrganizations([...organizations, data]);
      setNewOrgName("");
      setIsDialogOpen(false);
      onSelect(data);
    } catch (error) {
      console.error("Error creating organization:", error);
    } finally {
      setIsCreating(false);
    }
  }

  const handleSelectOrg = (org: Organization) => {
    setSelectedOrgState(org);
    onSelect(org);
    setIsOpen(false);
  };

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent-1">
            {selectedOrg?.icon || <Building2 className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {selectedOrg?.name || "Select Organization"}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="w-80 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
            sideOffset={8}
            align="start"
            style={{ zIndex: 100 }}
          >
            <div className="space-y-1">
              {organizations.map((org) => (
                <div key={org.id} className="space-y-1">
                  <button
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent-1 text-left"
                    onClick={() => handleSelectOrg(org)}
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm flex-1">{org.name}</span>
                  </button>
                  {String(selectedOrg?.id) === String(org.id) &&
                    missions.length > 0 && (
                      <div className="ml-4 pl-4 border-l border-accent-2">
                        {missions.map((mission) => (
                          <div key={mission.id} className="py-1">
                            <Target className="w-3 h-3 inline mr-2 text-gray-400" />
                            <span className="text-sm text-gray-400">
                              {mission.name}
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
                New Organization
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-background border border-accent-2 rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">
                Create Organization
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-300">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreateOrganization}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Organization Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
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
                    {isCreating ? "Creating..." : "Create Organization"}
                  </button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
