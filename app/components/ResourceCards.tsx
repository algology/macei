"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  MoreHorizontal,
  Trash2,
  Building2,
  Target,
  Lightbulb,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Resource, ResourceConfig, Organization, Mission } from "./types";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { CreateMissionDialog } from "./CreateMissionDialog";

interface Props<T extends Resource> {
  config: ResourceConfig;
  onSelect?: (resource: T) => void;
}

function isOrganization(resource: Resource): resource is Organization {
  return "missions" in resource;
}

function isMission(resource: Resource): resource is Mission {
  return "organization_id" in resource && "ideas" in resource;
}

export function ResourceCards<T extends Resource>({
  config,
  onSelect,
}: Props<T>) {
  const [resources, setResources] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchResources();
  }, [config]);

  async function fetchResources() {
    setLoading(true);
    let query;

    if (config.tableName === "organizations") {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        console.error("Error fetching session or user not logged in:", sessionError);
        setResources([]);
        setLoading(false);
        return;
      }
      const userId = sessionData.session.user.id;

      query = supabase
        .from('organization_members')
        .select(`
          role,
          organizations!inner (
            *,
            missions (*)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { foreignTable: 'organizations', ascending: false });

      const { data: memberData, error: memberError } = await query;

      if (memberError) {
        console.error("Error fetching organization memberships:", memberError);
        setResources([]);
      } else {
        // Extract the organization data from the membership results
        // Cast to unknown first to satisfy TypeScript when dealing with complex query results
        const orgData = memberData?.map(member => member.organizations).filter(org => org !== null) as unknown as T[] ?? [];
        setResources(orgData);
      }
    } else if (config.tableName === "missions" && config.foreignKey?.value) {
      query = supabase
        .from(config.tableName)
        .select("*, organization:organizations(*), ideas:ideas(id, conviction)")
        .eq("organization_id", config.foreignKey.value)
        .order("created_at", { ascending: false });

      const { data: missionData, error: missionError } = await query;
      if (missionError) {
        console.error(`Error fetching missions for org ${config.foreignKey.value}:`, missionError);
        setResources([]);
      } else {
        setResources((missionData as T[]) || []);
      }
    } else {
      console.warn(`ResourceCards: Unhandled tableName '${config.tableName}' or missing foreignKey. Fetching all.`);
      query = supabase.from(config.tableName).select('*').order("created_at", { ascending: false });

      const { data: otherData, error: otherError } = await query;
      if (otherError) {
        console.error(`Error fetching ${config.tableName}:`, otherError);
        setResources([]);
      } else {
        setResources((otherData as T[]) || []);
      }
    }

    setLoading(false);
  }

  async function handleDelete(id: number) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        throw new Error("You must be authenticated to delete resources");
      }

      // First delete all related ideas if deleting a mission
      if (config.tableName === "missions") {
        const { error: ideasError } = await supabase
          .from("ideas")
          .delete()
          .eq("mission_id", id);

        if (ideasError) throw ideasError;
      }

      // Then delete all related missions if deleting an organization
      if (config.tableName === "organizations") {
        // Get all missions for this organization
        const { data: missions } = await supabase
          .from("missions")
          .select("id")
          .eq("organization_id", id);

        if (missions && missions.length > 0) {
          // Delete ideas for all missions
          const missionIds = missions.map((m) => m.id);
          const { error: ideasError } = await supabase
            .from("ideas")
            .delete()
            .in("mission_id", missionIds);

          if (ideasError) throw ideasError;

          // Then delete the missions
          const { error: missionsError } = await supabase
            .from("missions")
            .delete()
            .eq("organization_id", id);

          if (missionsError) throw missionsError;
        }
      }

      // Finally delete the resource itself
      const { error, data } = await supabase
        .from(config.tableName)
        .delete()
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Resource not found or you don't have permission to delete it"
        );
      }

      setResources(resources.filter((resource) => resource.id !== id));
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource. Please try again.");
    }
  }

  const handleCardClick = (resource: T) => {
    if (config.tableName === "organizations") {
      router.push(`/dashboard/org/${resource.id}`);
    } else if (config.tableName === "missions") {
      router.push(
        `/dashboard/org/${config.foreignKey?.value}/mission/${resource.id}`
      );
    }
    if (onSelect) {
      onSelect(resource);
    }
  };

  const getIcon = () => {
    switch (config.iconType) {
      case "organization":
        return <Building2 className="w-5 h-5 text-gray-400" />;
      case "mission":
        return <Target className="w-5 h-5 text-gray-400" />;
      case "idea":
        return <Lightbulb className="w-5 h-5 text-gray-400" />;
    }
  };

  async function handleCreateResource(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        throw new Error("You must be authenticated to create resources");
      }

      const newResource = {
        name: newResourceName,
        ...(config.tableName === "organizations" && {
          user_id: session.user.id,
        }),
        ...(config.foreignKey && {
          [config.foreignKey.name]: config.foreignKey.value,
        }),
      };

      const { data, error } = await supabase
        .from(config.tableName)
        .insert([newResource])
        .select()
        .single();

      if (error) throw error;

      setResources([data, ...resources]);
      setNewResourceName("");
      setIsDialogOpen(false);

      if (onSelect) {
        onSelect(data);
      }

      // Navigate to the new resource if it's an organization
      if (config.tableName === "organizations") {
        router.push(`/dashboard/org/${data.id}`);
      }
    } catch (error) {
      console.error("Error creating resource:", error);
      alert("Failed to create resource. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleMissionCreated = (mission: Mission) => {
    if (config.tableName === "missions") {
      setResources((prev) => [mission as unknown as T, ...prev]);
      if (onSelect) {
        onSelect(mission as unknown as T);
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{config.resourceName}</h1>
        {config.tableName === "missions" ? (
          <button
            onClick={() => setIsDialogOpen(true)}
            className="px-4 py-2 bg-green-500/20 text-green-400 text-sm flex items-center gap-2 border border-green-900 hover:bg-green-500/30 rounded-md"
          >
            <Plus className="w-4 h-4" />
            New Mission
          </button>
        ) : (
          <button
            onClick={() => setIsDialogOpen(true)}
            className="px-4 py-2 bg-green-500/20 text-green-400 text-sm flex items-center gap-2 border border-green-900 hover:bg-green-500/30 rounded-md"
          >
            <Plus className="w-4 h-4" />
            New Organization
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="group relative bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-4 hover:bg-accent-1/70 transition-colors cursor-pointer"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('[role="menuitem"]')) {
                return;
              }
              handleCardClick(resource);
            }}
          >
            <div className="p-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-1 rounded-lg border border-accent-2">
                    {getIcon()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">
                      {resource.name}
                      {config.tableName === "missions" && (
                        <span className="ml-2 text-sm text-gray-400">
                          {resource.ideas?.length || 0} ideas
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Created{" "}
                      {new Date(resource.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className="p-2 hover:bg-accent-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="w-48 bg-background border border-accent-2 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95">
                      <DropdownMenu.Item
                        onSelect={(e) => {
                          e.preventDefault();
                          const path =
                            config.tableName === "organizations"
                              ? `/dashboard/org/${resource.id}/edit`
                              : isMission(resource)
                              ? `/dashboard/org/${resource.organization_id}/mission/${resource.id}/edit`
                              : "#";
                          router.push(path);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-400 hover:text-gray-300 hover:bg-accent-1 rounded-md outline-none cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => handleDelete(resource.id)}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-accent-1 rounded-md outline-none cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              {config.tableName === "organizations" &&
                isOrganization(resource) &&
                resource.missions &&
                resource.missions.length > 0 && (
                  <div className="mt-4 pl-4 border-l border-accent-2">
                    {resource.missions.map((mission) => (
                      <div
                        key={mission.id}
                        className="flex items-center gap-2 py-1"
                      >
                        <Target className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-400">
                          {mission.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>

      {config.tableName === "missions" && config.foreignKey && (
        <CreateMissionDialog
          organizationId={config.foreignKey.value}
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onMissionCreated={handleMissionCreated}
        />
      )}

      {config.tableName === "organizations" && (
        <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-background border border-accent-2 rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title className="text-lg font-medium">
                  Create {config.resourceName.slice(0, -1)}
                </Dialog.Title>
                <Dialog.Close className="text-gray-400 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              </div>

              <Dialog.Description className="text-sm text-gray-400 mb-4">
                Create a new {config.resourceName.toLowerCase().slice(0, -1)} to
                organize your work.
              </Dialog.Description>

              <form onSubmit={handleCreateResource}>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-300 mb-1"
                    >
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={newResourceName}
                      onChange={(e) => setNewResourceName(e.target.value)}
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
                      {isCreating
                        ? "Creating..."
                        : `Create ${config.resourceName.slice(0, -1)}`}
                    </button>
                  </div>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
