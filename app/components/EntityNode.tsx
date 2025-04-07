import { memo } from "react";
import { Handle, Position } from "reactflow";
import { FileText, Bell, Calendar, Globe, Link, LineChart, BarChart2 } from "lucide-react";
import { useState } from "react";

interface EntityNodeData {
  label: string;
  icon: React.ReactNode;
  type?: "organization" | "mission" | "idea" | "signal";
  document_count?: number;
  briefing_count?: number;
  signals?: string[];
  last_briefing_date?: string;
  // Signal specific properties
  url?: string;
  source?: string;
  source_name?: string;
  publication_date?: string;
  relevance_score?: number;
  relatedIdeasCount?: number;
  description?: string;
}

function EntityNode({ data }: { data: EntityNodeData }) {
  // Format the date to a readable format if it exists
  const formattedDate = data.last_briefing_date
    ? new Date(data.last_briefing_date).toLocaleDateString()
    : undefined;
    
  const formattedPublicationDate = data.publication_date
    ? new Date(data.publication_date).toLocaleDateString()
    : undefined;
    
  // For favicon display
  const [faviconError, setFaviconError] = useState(false);

  // Helper to extract domain from URL
  const extractDomain = (url: string) => {
    if (!url) return '';
    try {
      const domain = url.replace(/^https?:\/\//, '').split('/')[0];
      return domain;
    } catch (error) {
      return url.replace(/^https?:\/\//, '');
    }
  };

  // Create a summary string for signals
  const signalsSummary =
    data.signals && data.signals.length > 0
      ? `${data.signals.length} signals`
      : null;
  
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg border border-accent-2 bg-background">
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <div className="flex flex-col gap-1 min-w-[200px]">
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
        {data.type === "signal" && (
          <div className="text-xs text-muted-foreground space-y-1 mt-1 pl-2 border-l-2 border-purple-400">
            {data.url && (
              <div className="flex items-center gap-1">
                {!faviconError ? (
                  <img 
                    src={`https://www.google.com/s2/favicons?domain=${extractDomain(data.url)}&sz=32`}
                    alt=""
                    className="w-3 h-3"
                    onError={() => setFaviconError(true)}
                  />
                ) : (
                  <Globe className="w-3 h-3" />
                )}
                <a 
                  href={data.url.startsWith('http') ? data.url : `https://${data.url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline truncate max-w-[140px]"
                >
                  {extractDomain(data.url)}
                </a>
              </div>
            )}
            
            {formattedPublicationDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formattedPublicationDate}</span>
              </div>
            )}
            
            {data.relevance_score !== undefined && (
              <div className="flex items-center gap-1">
                <BarChart2 className="w-3 h-3" />
                <span className="flex items-center">
                  <span className="mr-1">Relevance:</span>
                  <div className="w-10 h-1.5 rounded-full bg-gray-700 mr-1">
                    <div 
                      className="h-full rounded-full bg-purple-500" 
                      style={{ width: `${data.relevance_score}%` }}
                    />
                  </div>
                  <span>{data.relevance_score}%</span>
                </span>
              </div>
            )}
            
            {data.source_name && (
              <div className="flex items-center gap-1">
                <Link className="w-3 h-3" />
                <span className="truncate max-w-[160px]">Source: {data.source_name}</span>
              </div>
            )}
            
            {!data.url && !data.source_name && !formattedPublicationDate && !data.relevance_score && (
              <div className="flex items-center gap-1">
                <LineChart className="w-3 h-3" />
                <span>Market signal</span>
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
