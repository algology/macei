import { Layout, Network, Grid } from "lucide-react";

interface Props {
  layout: "hierarchical" | "force" | "grid";
  onLayoutChange: (layout: "hierarchical" | "force" | "grid") => void;
}

export function KnowledgeGraphControls({ layout, onLayoutChange }: Props) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onLayoutChange("hierarchical")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          layout === "hierarchical"
            ? "bg-accent-1 border-accent-2 text-white"
            : "border-gray-800 text-gray-400 hover:border-accent-2"
        }`}
      >
        <Layout className="w-4 h-4" />
        <span>Hierarchical</span>
      </button>
      <button
        onClick={() => onLayoutChange("force")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          layout === "force"
            ? "bg-accent-1 border-accent-2 text-white"
            : "border-gray-800 text-gray-400 hover:border-accent-2"
        }`}
      >
        <Network className="w-4 h-4" />
        <span>Force-Directed</span>
      </button>
      <button
        onClick={() => onLayoutChange("grid")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          layout === "grid"
            ? "bg-accent-1 border-accent-2 text-white"
            : "border-gray-800 text-gray-400 hover:border-accent-2"
        }`}
      >
        <Grid className="w-4 h-4" />
        <span>Grid</span>
      </button>
    </div>
  );
}
