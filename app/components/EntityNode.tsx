import { memo } from "react";
import { Handle, Position } from "reactflow";

function EntityNode({
  data,
}: {
  data: { label: string; icon: React.ReactNode };
}) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg border border-accent-2 bg-background">
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <div className="flex items-center gap-2">
        {data.icon}
        <span className="text-sm font-medium">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2" />
    </div>
  );
}

export default memo(EntityNode);
