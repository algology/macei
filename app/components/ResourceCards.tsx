"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  MoreHorizontal,
  Trash2,
  Building2,
  Target,
  Lightbulb,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Resource, ResourceConfig } from "./types";
import { useRouter } from "next/navigation";

interface Props<T extends Resource> {
  config: ResourceConfig;
  onSelect?: (resource: T) => void;
}

export function ResourceCards<T extends Resource>({
  config,
  onSelect,
}: Props<T>) {
  const [resources, setResources] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchResources();
  }, [config]);

  async function fetchResources() {
    let query = supabase.from(config.tableName).select();

    if (config.tableName === "missions") {
      query = supabase
        .from(config.tableName)
        .select("*, organization:organization_id(*)");
    } else if (config.tableName === "ideas") {
      query = supabase
        .from(config.tableName)
        .select("*, mission:mission_id(*, organization:organization_id(*))");
    }

    if (config.foreignKey) {
      query = query.eq(config.foreignKey.name, config.foreignKey.value);
    }

    const { data } = await query.order("created_at", { ascending: false });
    setResources(data || []);
    setLoading(false);
  }

  async function handleDelete(id: number) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        throw new Error("You must be authenticated to delete resources");
      }

      if (config.tableName === "organizations") {
        // First delete all related missions
        const { error: missionsError } = await supabase
          .from("missions")
          .delete()
          .eq("organization_id", id);

        if (missionsError) throw missionsError;
      }

      if (config.tableName === "missions") {
        // First delete all related ideas
        const { error: ideasError } = await supabase
          .from("ideas")
          .delete()
          .eq("mission_id", id);

        if (ideasError) throw ideasError;
      }

      // Now delete the resource itself
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-gray-400">Loading {config.resourceName}...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{config.resourceName}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map((resource) => (
          <div
            key={resource.id}
            onClick={() => handleCardClick(resource)}
            className="group flex flex-col justify-between bg-background/40 backdrop-blur-sm border border-accent-2 rounded-xl hover:border-accent-3 transition-all duration-200 cursor-pointer"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-1 rounded-lg border border-accent-2">
                    {getIcon()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">
                      {resource.name}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
