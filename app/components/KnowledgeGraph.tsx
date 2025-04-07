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
import { Building2, Target, Lightbulb, LineChart } from "lucide-react";
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
    document_count?: number;
    briefing_count?: number;
    signals?: string[];
    last_briefing_date?: string;
  }>;
  signals?: Array<{
    id: string;
    name: string;
    relatedIdeas: string[];
    relatedIdeasCount?: number;
    url?: string;
    source?: string;
    source_name?: string;
    publication_date?: string;
    relevance_score?: number;
    description?: string;
  }>;
}

export function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layout, setLayout] = useState<"horizontal">("horizontal");

  const fetchGraphData = useCallback(async () => {
    // Fetch organizations with their missions
    const { data: organizations } = await supabase
      .from("organizations")
      .select("id, name, missions(id, name)");

    // Fetch all ideas
    const { data: ideas } = await supabase
      .from("ideas")
      .select("id, name, mission_id, signals");

    // Fetch knowledge base signals
    const { data: knowledgeBaseSignals } = await supabase
      .from("knowledge_base")
      .select("id, idea_id, title, source_url, source_name, source_type, publication_date, relevance_score, content")
      .order("relevance_score", { ascending: false });

    // Enhanced ideas with additional information
    const enhancedIdeas = await Promise.all(
      (ideas || []).map(async (idea) => {
        // Fetch document count
        const { count: documentCount } = await supabase
          .from("idea_documents")
          .select("id", { count: "exact", head: true })
          .eq("idea_id", idea.id);

        // Fetch briefing count and latest briefing
        const { data: briefings } = await supabase
          .from("briefings")
          .select("id, date_to")
          .eq("idea_id", idea.id)
          .order("date_to", { ascending: false });

        // Parse signals if they exist (just for backwards compatibility)
        let parsedSignals = [];
        try {
          parsedSignals = idea.signals ? JSON.parse(idea.signals) : [];
          // Handle multiple potential formats (array, object, or string)
          if (!Array.isArray(parsedSignals)) {
            if (typeof parsedSignals === "object" && parsedSignals !== null) {
              parsedSignals = Object.values(parsedSignals);
            } else {
              parsedSignals = idea.signals.split(",").map((s: string) => s.trim());
            }
          }
        } catch (error) {
          // Fallback to comma-separated string if parsing fails
          parsedSignals = idea.signals
            ? idea.signals.split(",").map((s: string) => s.trim())
            : [];
        }

        return {
          ...idea,
          document_count: documentCount || 0,
          briefing_count: briefings?.length || 0,
          signals: parsedSignals,
          last_briefing_date: briefings?.[0]?.date_to || null,
        };
      })
    );

    // Map signals by idea ID
    const signalsByIdeaMap = new Map<string, any[]>();
    
    (knowledgeBaseSignals || []).forEach(signal => {
      if (!signalsByIdeaMap.has(signal.idea_id)) {
        signalsByIdeaMap.set(signal.idea_id, []);
      }
      signalsByIdeaMap.get(signal.idea_id)?.push(signal);
    });

    // Create signals array for graph
    const signalNodes = [];
    
    // Track all signal-idea relationships
    const signalIdeaRelationships = new Map<string, string[]>();
    
    for (const [ideaId, ideaSignals] of signalsByIdeaMap.entries()) {
      for (const signal of ideaSignals) {
        const signalId = `signal-${signal.id}`;
        
        // Create the signal node
        signalNodes.push({
          id: signalId,
          name: signal.title,
          url: signal.source_url,
          source: signal.source_type,
          source_name: signal.source_name,
          publication_date: signal.publication_date,
          relevance_score: signal.relevance_score,
          description: signal.content?.substring(0, 150) + (signal.content?.length > 150 ? '...' : ''),
          relatedIdeas: [ideaId],
        });
        
        // Update relationships
        if (!signalIdeaRelationships.has(signalId)) {
          signalIdeaRelationships.set(signalId, []);
        }
        signalIdeaRelationships.get(signalId)?.push(ideaId);
      }
    }
    
    // Merge signals with the same ID
    const mergedSignals = [];
    const processedSignalIds = new Set<string>();
    
    for (const signal of signalNodes) {
      if (!processedSignalIds.has(signal.id)) {
        const relatedIdeas = signalIdeaRelationships.get(signal.id) || [];
        mergedSignals.push({
          ...signal,
          relatedIdeas,
          relatedIdeasCount: relatedIdeas.length,
        });
        processedSignalIds.add(signal.id);
      }
    }

    return {
      organizations: organizations || [],
      ideas: enhancedIdeas || [],
      signals: mergedSignals,
    } as GraphData;
  }, []);

  const createGraphLayout = useCallback(
    (data: GraphData, layoutType: "horizontal") => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      // Horizontal layout implementation
      // Horizontal spacing between columns
      const HORIZONTAL_SPACING_H = 350;
      // Vertical spacing between nodes at the same level
      const VERTICAL_SPACING_H = 150;
      
      // Column positions
      const ORG_X_H = 50;
      const MISSION_X_H = ORG_X_H + HORIZONTAL_SPACING_H;
      const IDEA_X_H = MISSION_X_H + HORIZONTAL_SPACING_H;
      const SIGNAL_X_H = IDEA_X_H + HORIZONTAL_SPACING_H;
      
      // Maps to track child nodes for each parent
      const missionsByOrg: { [orgId: string]: string[] } = {};
      const ideasByMission: { [missionId: string]: string[] } = {};
      const signalsByIdea: { [ideaId: string]: string[] } = {};
      
      // First pass: organize data into parent-child relationships
      // Map missions to organizations
      data.organizations?.forEach(org => {
        missionsByOrg[org.id] = org.missions?.map(m => m.id) || [];
      });
      
      // Map ideas to missions
      data.ideas?.forEach(idea => {
        if (idea.mission_id) {
          if (!ideasByMission[idea.mission_id]) {
            ideasByMission[idea.mission_id] = [];
          }
          ideasByMission[idea.mission_id].push(idea.id);
        }
      });
      
      // Map signals to ideas
      data.signals?.forEach(signal => {
        signal.relatedIdeas.forEach(ideaId => {
          if (!signalsByIdea[ideaId]) {
            signalsByIdea[ideaId] = [];
          }
          signalsByIdea[ideaId].push(signal.id);
        });
      });
      
      // Second pass: calculate vertical positioning
      // Start with signals since they're the leaf nodes
      const signalPositions: { [id: string]: number } = {};
      let nextSignalY = 0;
      
      // Position signals vertically with even spacing
      Object.values(signalsByIdea).forEach(signalIds => {
        const signalCount = signalIds.length;
        if (signalCount > 0) {
          const startY = nextSignalY;
          signalIds.forEach((signalId, index) => {
            signalPositions[signalId] = startY + (index * VERTICAL_SPACING_H);
          });
          nextSignalY = startY + (signalCount * VERTICAL_SPACING_H) + VERTICAL_SPACING_H;
        }
      });
      
      // Calculate idea positions based on their related signals
      const ideaPositions: { [id: string]: number } = {};
      data.ideas?.forEach(idea => {
        const relatedSignals = signalsByIdea[idea.id] || [];
        
        if (relatedSignals.length > 0) {
          // Position idea at the center of its signals
          let signalSum = 0;
          let sigCount = 0;
          
          relatedSignals.forEach(signalId => {
            if (signalPositions[signalId] !== undefined) {
              signalSum += signalPositions[signalId];
              sigCount++;
            }
          });
          
          if (sigCount > 0) {
            ideaPositions[idea.id] = signalSum / sigCount;
          }
        }
      });
      
      // Ensure all ideas have positions, even those without signals
      let lastY = 0;
      Object.entries(ideasByMission).forEach(([missionId, ideaIds]) => {
        // Position ideas without signals after those with signals
        const positionedIdeas = ideaIds.filter(id => ideaPositions[id] !== undefined);
        const unpositionedIdeas = ideaIds.filter(id => ideaPositions[id] === undefined);
        
        if (positionedIdeas.length > 0) {
          // Find max Y position among positioned ideas
          const maxY = Math.max(...positionedIdeas.map(id => ideaPositions[id]));
          lastY = Math.max(lastY, maxY + VERTICAL_SPACING_H);
        }
        
        // Assign positions to unpositioned ideas
        unpositionedIdeas.forEach(ideaId => {
          ideaPositions[ideaId] = lastY;
          lastY += VERTICAL_SPACING_H;
        });
      });
      
      // Calculate mission positions based on their ideas
      const missionPositions: { [id: string]: number } = {};
      Object.entries(ideasByMission).forEach(([missionId, ideaIds]) => {
        if (ideaIds.length > 0) {
          // Position mission at center of its ideas
          const sum = ideaIds.reduce((acc, ideaId) => acc + (ideaPositions[ideaId] || 0), 0);
          missionPositions[missionId] = sum / ideaIds.length;
        }
      });
      
      // Ensure all missions have positions, even those without ideas
      lastY = 0;
      Object.entries(missionsByOrg).forEach(([orgId, missionIds]) => {
        // Position missions without ideas after those with ideas
        const positionedMissions = missionIds.filter(id => missionPositions[id] !== undefined);
        const unpositionedMissions = missionIds.filter(id => missionPositions[id] === undefined);
        
        if (positionedMissions.length > 0) {
          // Find max Y position among positioned missions
          const maxY = Math.max(...positionedMissions.map(id => missionPositions[id]));
          lastY = Math.max(lastY, maxY + VERTICAL_SPACING_H);
        }
        
        // Assign positions to unpositioned missions
        unpositionedMissions.forEach(missionId => {
          missionPositions[missionId] = lastY;
          lastY += VERTICAL_SPACING_H;
        });
      });
      
      // Calculate organization positions based on their missions
      const orgPositions: { [id: string]: number } = {};
      data.organizations?.forEach(org => {
        const missionIds = missionsByOrg[org.id] || [];
        
        if (missionIds.length > 0) {
          // Position organization at center of its missions
          const sum = missionIds.reduce((acc, missionId) => acc + (missionPositions[missionId] || 0), 0);
          orgPositions[org.id] = sum / missionIds.length;
        } else {
          // Fallback for orgs with no missions
          orgPositions[org.id] = lastY;
          lastY += VERTICAL_SPACING_H;
        }
      });
      
      // Third pass: create nodes and edges using calculated positions
      // Create organization nodes
      data.organizations?.forEach(org => {
        nodes.push({
          id: `org-${org.id}`,
          data: {
            label: org.name,
            icon: <Building2 className="w-4 h-4 text-blue-400" />,
            type: "organization",
          },
          position: {
            x: ORG_X_H,
            y: orgPositions[org.id] || 0
          },
          type: "entityNode",
        });
        
        // Create mission nodes and edges
        org.missions?.forEach(mission => {
          nodes.push({
            id: `mission-${mission.id}`,
            data: {
              label: mission.name,
              icon: <Target className="w-4 h-4 text-green-400" />,
              type: "mission",
            },
            position: {
              x: MISSION_X_H,
              y: missionPositions[mission.id] || 0
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
      data.ideas?.forEach(idea => {
        // Count market signals (ones with relevance scores)
        const marketSignalCount = (data.signals || [])
          .filter(signal => signal.relatedIdeas.includes(idea.id) && signal.relevance_score !== undefined)
          .length;
          
        nodes.push({
          id: `idea-${idea.id}`,
          data: {
            label: idea.name,
            icon: <Lightbulb className="w-4 h-4 text-yellow-400" />,
            type: "idea",
            document_count: idea.document_count,
            briefing_count: idea.briefing_count,
            signals: idea.signals,
            market_signal_count: marketSignalCount,
            last_briefing_date: idea.last_briefing_date,
          },
          position: {
            x: IDEA_X_H,
            y: ideaPositions[idea.id] || 0
          },
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
      
      // Create signal nodes and edges
      data.signals?.forEach(signal => {
        nodes.push({
          id: signal.id,
          data: {
            label: signal.name,
            icon: <LineChart className="w-4 h-4 text-purple-400" />,
            type: "signal",
            relatedIdeasCount: signal.relatedIdeas.length,
            url: signal.url,
            source: signal.source,
            source_name: signal.source_name,
            publication_date: signal.publication_date,
            relevance_score: signal.relevance_score,
            description: signal.description
          },
          position: {
            x: SIGNAL_X_H,
            y: signalPositions[signal.id] || 0
          },
          type: "entityNode",
        });
        
        signal.relatedIdeas.forEach(ideaId => {
          edges.push({
            id: `idea-signal-${ideaId}-${signal.id}`,
            source: `idea-${ideaId}`,
            target: signal.id,
            type: "smoothstep",
            animated: true,
          });
        });
      });

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
