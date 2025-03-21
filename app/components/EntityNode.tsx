import { memo } from "react";
import { Handle, Position } from "reactflow";
import { FileText, Bell, Calendar } from "lucide-react";

interface EntityNodeData {
  label: string;
  icon: React.ReactNode;
  type?: "organization" | "mission" | "idea";
  document_count?: number;
  briefing_count?: number;
  signals?: string[];
  last_briefing_date?: string;
}

function EntityNode({ data }: { data: EntityNodeData }) {
  // Format the date to a readable format if it exists
  const formattedDate = data.last_briefing_date
    ? new Date(data.last_briefing_date).toLocaleDateString()
    : null;

  // Create a summary string for signals
  const signalsSummary =
    data.signals && data.signals.length > 0
      ? `${data.signals.length} signals`
      : null;

  return (
    <div className="px-4 py-2 shadow-lg rounded-lg border border-accent-2 bg-background">
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <div className="flex flex-col gap-1 min-w-[180px]">
        <div className="flex items-center gap-2">
          {data.icon}
          <span className="text-sm font-medium">{data.label}</span>
        </div>
        {data.type === "idea" && (
          <div className="text-xs text-muted-foreground space-y-1 mt-1 pl-2 border-l-2 border-accent-2">
            {data.document_count !== undefined && (
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>{data.document_count} documents</span>
              </div>
            )}
            {data.briefing_count !== undefined && (
              <div className="flex items-center gap-1">
                <Bell className="w-3 h-3" />
                <span>{data.briefing_count} briefings</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Last: {formattedDate}</span>
              </div>
            )}
            {signalsSummary && (
              <div className="flex items-center gap-1">
                <span className="text-xs">📊 {signalsSummary}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2" />
    </div>
  );
}

export default memo(EntityNode);
