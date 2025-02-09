"use client";

import { MissionCards } from "@/app/components/MissionCards";
import { DashboardLayout } from "@/app/components/DashboardLayout";
import { useParams } from "next/navigation";

export default function OrganizationPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  return (
    <DashboardLayout>
      <MissionCards organizationId={orgId} />
    </DashboardLayout>
  );
}
