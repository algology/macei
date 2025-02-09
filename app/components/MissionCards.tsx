import { Target } from "lucide-react";
import { ResourceCards } from "./ResourceCards";

interface Props {
  organizationId: string;
}

export function MissionCards({ organizationId }: Props) {
  const config = {
    resourceName: "Missions",
    icon: Target,
    tableName: "missions",
    foreignKey: {
      name: "organization_id",
      value: organizationId
    }
  };

  return <ResourceCards config={config} />;
}
