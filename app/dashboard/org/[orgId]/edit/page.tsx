"use client";

import { OrganizationDeepDive } from "@/app/components/OrganizationDeepDive";
import { DashboardLayout } from "@/app/components/DashboardLayout";
import { useParams } from "next/navigation";

export default function EditOrganizationPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  return (
    <DashboardLayout>
      <OrganizationDeepDive organizationId={orgId} />
    </DashboardLayout>
  );
}
