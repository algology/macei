"use client";

import { MissionDeepDive } from "@/app/components/MissionDeepDive";
import { DashboardLayout } from "@/app/components/DashboardLayout";
import { useParams } from "next/navigation";

export default function EditMissionPage() {
  const params = useParams();
  const missionId = params.missionId as string;

  return (
    <DashboardLayout>
      <MissionDeepDive missionId={missionId} />
    </DashboardLayout>
  );
}
