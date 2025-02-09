"use client";

import { Building2 } from "lucide-react";
import { ResourceCards } from "./ResourceCards";
import type { Organization } from "./types";

interface Props {
  onSelect?: (org: Organization) => void;
}

export function OrganizationCards({ onSelect }: Props) {
  const config = {
    resourceName: "Organizations",
    iconType: "organization" as const,
    tableName: "organizations",
  };

  return <ResourceCards<Organization> config={config} onSelect={onSelect} />;
}
