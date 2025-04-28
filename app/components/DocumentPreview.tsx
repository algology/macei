import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  url: string;
  name: string;
  type: string;
}

export function DocumentPreview({ url, name, type }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
    };
  }, [objectUrl]);

  async function handlePreview() {
    if (content || objectUrl) {
      setShowPreview(true);
      return;
    }

    try {
      setIsLoading(true);
      const filePath = url.split("idea-documents/")[1];

      const { data, error } = await supabase.storage
        .from("idea-documents")
        .download(filePath);

      if (error) throw error;
      if (!data) throw new Error("No data downloaded.");

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }

      if (type === "txt") {
        const text = await data.text();
        setContent(text);
      } else if (type === "pdf") {
        const blobUrl = URL.createObjectURL(data);
        setObjectUrl(blobUrl);
        setContent(null);
      } else {
        setContent("Preview not available for this file type yet");
        setObjectUrl(null);
      }

      setShowPreview(true);
    } catch (error) {
      console.error("Error loading preview:", error);
      alert("Failed to load preview");
    } finally {
      setIsLoading(false);
    }
  }

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  return (
    <>
      <button
        onClick={handlePreview}
        className="text-gray-400 hover:text-green-400 transition-colors"
        title="Preview"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>

      {showPreview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-accent-1 border border-accent-2 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-lg">
            <div className="flex justify-between items-center p-3 border-b border-accent-2 flex-shrink-0">
              <h3 className="font-semibold truncate pr-4">{name}</h3>
              <button
                onClick={handleClosePreview}
                className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-accent-2 transition-colors"
              >
                Close
              </button>
            </div>
            <div className="p-1 overflow-auto flex-grow">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
                  <span className="ml-3 text-gray-300">Loading preview...</span>
                </div>
              ) : type === "pdf" && objectUrl ? (
                <iframe
                  src={objectUrl}
                  className="w-full h-full min-h-[75vh] border-none"
                  title={name}
                />
              ) : content ? (
                <pre className="whitespace-pre-wrap font-mono text-sm p-3">
                  {content}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Preview could not be loaded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
