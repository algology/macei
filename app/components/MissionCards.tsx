import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Target, Plus } from "lucide-react";
import type { Mission } from "./types";

interface Props {
  organizationId: string;
}

export function MissionCards({ organizationId }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMissions() {
      const { data } = await supabase
        .from("missions")
        .select("*")
        .eq("organization_id", organizationId);

      setMissions(data || []);
      setLoading(false);
    }

    fetchMissions();
  }, [organizationId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Missions</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {missions.map((mission) => (
          <div
            key={mission.id}
            className="p-4 border border-accent-2 rounded-lg hover:border-accent-3 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium">{mission.name}</h2>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
