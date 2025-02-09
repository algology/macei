import { Target } from "lucide-react";
import { ResourceCards } from "./ResourceCards";
import type { Mission } from "./types";

interface Props {
  organizationId: string;
  onSelect?: (mission: Mission) => void;
}

export function MissionCards({ organizationId, onSelect }: Props) {
  const config = {
    resourceName: "Missions",
    iconType: "mission" as const,
    tableName: "missions",
    foreignKey: {
      name: "organization_id",
      value: organizationId,
    },
  };

  return <ResourceCards<Mission> config={config} onSelect={onSelect} />;
}
