"use client";

import { useParams } from "next/navigation";
import { OrganizationDeepDive } from "@/app/components/OrganizationDeepDive";

export default function EditOrganizationPage() {
  const params = useParams();
  const organizationId = params.id as string; // Get ID from URL

  if (!organizationId) {
    // Handle case where ID is not present, maybe show loading or error
    return <div>Loading organization details...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <OrganizationDeepDive organizationId={organizationId} />
    </div>
  );
}
