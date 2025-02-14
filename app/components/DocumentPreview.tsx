import { useState } from "react";
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

  async function handlePreview() {
    if (content) {
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

      if (type === "txt") {
        const text = await data.text();
        setContent(text);
      } else if (type === "pdf") {
        // For PDFs, we'll show an embedded viewer
        setContent(url);
      } else {
        setContent("Preview not available for this file type yet");
      }

      setShowPreview(true);
    } catch (error) {
      console.error("Error loading preview:", error);
      alert("Failed to load preview");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handlePreview}
        className="text-gray-400 hover:text-green-400 transition-colors"
        title="Preview"
      >
        <Eye className="w-4 h-4" />
      </button>

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-accent-1 border border-accent-2 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-accent-2">
              <h3 className="font-semibold">{name}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(80vh-4rem)]">
              {isLoading ? (
                <div className="text-center">Loading preview...</div>
              ) : type === "pdf" ? (
                <iframe
                  src={content || ""}
                  className="w-full h-[60vh]"
                  title={name}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
