"use client";

import { Building2 } from "lucide-react";
import { ResourceCards } from "./ResourceCards";

export function OrganizationCards() {
  const config = {
    resourceName: "Organizations",
    icon: Building2,
    tableName: "organizations"
  };

  return <ResourceCards config={config} />;
} 