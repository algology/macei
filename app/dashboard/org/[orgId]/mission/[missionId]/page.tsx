"use client";

import { IdeaCards } from "@/app/components/IdeaCards";
import { DashboardLayout } from "@/app/components/DashboardLayout";
import { useParams } from "next/navigation";

export default function MissionPage() {
  const params = useParams();
  const missionId = params.missionId as string;

  return (
    <DashboardLayout>
      <IdeaCards missionId={missionId} />
    </DashboardLayout>
  );
}
