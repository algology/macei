import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "@/lib/supabase";
import { Building2, Target, Lightbulb } from "lucide-react";
import EntityNode from "./EntityNode";
import { KnowledgeGraphControls } from "./KnowledgeGraphControls";

// Define node types
const nodeTypes = {
  entityNode: EntityNode,
};

interface GraphData {
  organizations: Array<{
    id: string;
    name: string;
    missions: Array<{
      id: string;
      name: string;
    }>;
  }>;
  ideas: Array<{
    id: string;
    name: string;
    mission_id: string;
  }>;
}

export function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layout, setLayout] = useState<"hierarchical" | "force" | "grid">(
    "hierarchical"
  );

  const fetchGraphData = useCallback(async () => {
    // Fetch organizations with their missions
    const { data: organizations } = await supabase
      .from("organizations")
      .select("id, name, missions(id, name)");

    // Fetch all ideas
    const { data: ideas } = await supabase
      .from("ideas")
      .select("id, name, mission_id");

    return {
      organizations: organizations || [],
      ideas: ideas || [],
    } as GraphData; // Type assertion since we know the structure matches
  }, []);

  const createGraphLayout = useCallback(
    (data: GraphData, layoutType: "hierarchical" | "force" | "grid") => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      switch (layoutType) {
        case "hierarchical":
          // Current layout logic
          data.organizations?.forEach((org, orgIndex) => {
            nodes.push({
              id: `org-${org.id}`,
              data: {
                label: org.name,
                icon: <Building2 className="w-4 h-4 text-blue-400" />,
              },
              position: { x: 100, y: orgIndex * 200 },
              type: "entityNode",
            });

            // Create mission nodes and edges for each organization
            org.missions?.forEach((mission: any, missionIndex: number) => {
              nodes.push({
                id: `mission-${mission.id}`,
                data: {
                  label: mission.name,
                  icon: <Target className="w-4 h-4 text-green-400" />,
                },
                position: { x: 400, y: orgIndex * 200 + missionIndex * 100 },
                type: "entityNode",
              });

              edges.push({
                id: `org-mission-${mission.id}`,
                source: `org-${org.id}`,
                target: `mission-${mission.id}`,
                type: "smoothstep",
                animated: true,
              });
            });
          });

          // Create idea nodes and edges
          data.ideas?.forEach((idea, ideaIndex) => {
            nodes.push({
              id: `idea-${idea.id}`,
              data: {
                label: idea.name,
                icon: <Lightbulb className="w-4 h-4 text-yellow-400" />,
              },
              position: { x: 700, y: ideaIndex * 100 },
              type: "entityNode",
            });

            edges.push({
              id: `mission-idea-${idea.id}`,
              source: `mission-${idea.mission_id}`,
              target: `idea-${idea.id}`,
              type: "smoothstep",
              animated: true,
            });
          });
          break;

        case "force":
          // Force-directed layout (circular arrangement)
          data.organizations?.forEach((org, index, array) => {
            const angle = (index / array.length) * 2 * Math.PI;
            const radius = 300;
            nodes.push({
              id: `org-${org.id}`,
              data: {
                label: org.name,
                icon: <Building2 className="w-4 h-4 text-blue-400" />,
              },
              position: {
                x: Math.cos(angle) * radius + 400,
                y: Math.sin(angle) * radius + 400,
              },
              type: "entityNode",
            });

            // Create mission nodes and edges for each organization
            org.missions?.forEach((mission: any, missionIndex: number) => {
              nodes.push({
                id: `mission-${mission.id}`,
                data: {
                  label: mission.name,
                  icon: <Target className="w-4 h-4 text-green-400" />,
                },
                position: {
                  x: Math.cos(angle + Math.PI / 2) * radius + 400,
                  y: Math.sin(angle + Math.PI / 2) * radius + 400,
                },
                type: "entityNode",
              });

              edges.push({
                id: `org-mission-${mission.id}`,
                source: `org-${org.id}`,
                target: `mission-${mission.id}`,
                type: "smoothstep",
                animated: true,
              });
            });
          });

          // Create idea nodes and edges
          data.ideas?.forEach((idea, ideaIndex) => {
            nodes.push({
              id: `idea-${idea.id}`,
              data: {
                label: idea.name,
                icon: <Lightbulb className="w-4 h-4 text-yellow-400" />,
              },
              position: { x: 700, y: ideaIndex * 100 },
              type: "entityNode",
            });

            edges.push({
              id: `mission-idea-${idea.id}`,
              source: `mission-${idea.mission_id}`,
              target: `idea-${idea.id}`,
              type: "smoothstep",
              animated: true,
            });
          });
          break;

        case "grid":
          // Grid layout
          let gridIndex = 0;
          const GRID_SIZE = 150;
          const COLS = 5;

          data.organizations?.forEach((org) => {
            nodes.push({
              id: `org-${org.id}`,
              data: {
                label: org.name,
                icon: <Building2 className="w-4 h-4 text-blue-400" />,
              },
              position: {
                x: (gridIndex % COLS) * GRID_SIZE,
                y: Math.floor(gridIndex / COLS) * GRID_SIZE,
              },
              type: "entityNode",
            });
            gridIndex++;

            // Create mission nodes and edges for each organization
            org.missions?.forEach((mission: any, missionIndex: number) => {
              nodes.push({
                id: `mission-${mission.id}`,
                data: {
                  label: mission.name,
                  icon: <Target className="w-4 h-4 text-green-400" />,
                },
                position: {
                  x: (gridIndex % COLS) * GRID_SIZE,
                  y: Math.floor(gridIndex / COLS) * GRID_SIZE,
                },
                type: "entityNode",
              });

              edges.push({
                id: `org-mission-${mission.id}`,
                source: `org-${org.id}`,
                target: `mission-${mission.id}`,
                type: "smoothstep",
                animated: true,
              });
            });
          });

          // Create idea nodes and edges
          data.ideas?.forEach((idea, ideaIndex) => {
            nodes.push({
              id: `idea-${idea.id}`,
              data: {
                label: idea.name,
                icon: <Lightbulb className="w-4 h-4 text-yellow-400" />,
              },
              position: { x: 700, y: ideaIndex * 100 },
              type: "entityNode",
            });

            edges.push({
              id: `mission-idea-${idea.id}`,
              source: `mission-${idea.mission_id}`,
              target: `idea-${idea.id}`,
              type: "smoothstep",
              animated: true,
            });
          });
          break;
      }

      return { nodes, edges };
    },
    []
  );

  useEffect(() => {
    async function initializeGraph() {
      const data = await fetchGraphData();
      const { nodes, edges } = createGraphLayout(data, layout);
      setNodes(nodes);
      setEdges(edges);
    }

    initializeGraph();
  }, [fetchGraphData, createGraphLayout, layout, setNodes, setEdges]);

  return (
    <div className="space-y-4">
      <KnowledgeGraphControls layout={layout} onLayoutChange={setLayout} />
      <div className="w-full h-[calc(90vh-160px)] bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-2xl">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
