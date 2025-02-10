"use client";

import { DashboardLayout } from "@/app/components/DashboardLayout";
import { IdeaDeepDive } from "@/app/components/IdeaDeepDive";
import { useParams } from "next/navigation";

export default function IdeaPage() {
  const params = useParams();
  const ideaId = params.ideaId as string;

  return (
    <DashboardLayout>
      <IdeaDeepDive ideaId={ideaId} />
    </DashboardLayout>
  );
}
