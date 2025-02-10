"use client";

import { DashboardLayout } from "@/app/components/DashboardLayout";
import { KnowledgeGraph } from "@/app/components/KnowledgeGraph";

export default function KnowledgeGraphPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Knowledge Graph</h1>
        <KnowledgeGraph />
      </div>
    </DashboardLayout>
  );
}
