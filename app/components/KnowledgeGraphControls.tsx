import { Layout } from "lucide-react";

interface Props {
  layout: "horizontal";
  onLayoutChange: (layout: "horizontal") => void;
}

export function KnowledgeGraphControls({ layout, onLayoutChange }: Props) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onLayoutChange("horizontal")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          layout === "horizontal"
            ? "bg-accent-1 border-accent-2 text-white"
            : "border-gray-800 text-gray-400 hover:border-accent-2"
        }`}
      >
        <Layout className="w-4 h-4" />
        <span>Organize</span>
      </button>
    </div>
  );
}
