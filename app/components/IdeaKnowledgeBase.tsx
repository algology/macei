import { useState, useEffect } from "react";
import { Upload, File, Trash2, Newspaper, Book, Lightbulb } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Document } from "./types";
import { DocumentPreview } from "./DocumentPreview";

interface Props {
  ideaId: number;
  onDocumentAdded: () => void;
}

interface KnowledgeBaseEntry {
  id: number;
  title: string;
  content: string;
  source_url: string;
  source_type: "news" | "academic" | "patent";
  source_name: string;
  publication_date: string;
  relevance_score: number;
  metadata: any;
  created_at: string;
}

export function IdeaKnowledgeBase({ ideaId, onDocumentAdded }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [marketSignals, setMarketSignals] = useState<KnowledgeBaseEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "documents" | "signals">(
    "all"
  );

  // Combine fetch functions into one
  const fetchData = async () => {
    await Promise.all([fetchDocuments(), fetchMarketSignals()]);
  };

  useEffect(() => {
    fetchData();
  }, [ideaId]);

  // Expose fetch method to parent components
  useEffect(() => {
    const element = document.querySelector('[data-component="knowledge-base"]');
    if (element) {
      (element as any).__fetchData = fetchData;
    }
  }, []);

  async function fetchDocuments() {
    try {
      const { data, error } = await supabase
        .from("idea_documents")
        .select("*")
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  }

  async function fetchMarketSignals() {
    try {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("idea_id", ideaId)
        .order("relevance_score", { ascending: false });

      if (error) throw error;
      setMarketSignals(data || []);
    } catch (error) {
      console.error("Error fetching market signals:", error);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${ideaId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("idea-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("idea-documents").getPublicUrl(filePath);

      // Store document reference in the database
      const { error: dbError } = await supabase.from("idea_documents").insert({
        idea_id: ideaId,
        name: file.name,
        url: publicUrl,
      });

      if (dbError) throw dbError;

      await fetchDocuments();
      onDocumentAdded();
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(documentId: number, url: string) {
    try {
      // Extract the file path from the URL
      const filePath = url.split("idea-documents/")[1];

      // Delete from Storage
      const { error: storageError } = await supabase.storage
        .from("idea-documents")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("idea_documents")
        .delete()
        .eq("id", documentId);

      if (dbError) throw dbError;

      setDocuments(documents.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document. Please try again.");
    }
  }

  async function handleDeleteSignal(signalId: number) {
    try {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", signalId);

      if (error) throw error;

      setMarketSignals(
        marketSignals.filter((signal) => signal.id !== signalId)
      );
    } catch (error) {
      console.error("Error deleting signal:", error);
      alert("Failed to delete signal. Please try again.");
    }
  }

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "academic":
        return <Book className="w-4 h-4 text-blue-400" />;
      case "patent":
        return <Lightbulb className="w-4 h-4 text-yellow-400" />;
      default:
        return <Newspaper className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4" data-component="knowledge-base">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Knowledge Base</h3>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-accent-2 overflow-hidden">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-sm ${
                activeTab === "all"
                  ? "bg-accent-1 text-white"
                  : "text-gray-400 hover:text-white hover:bg-accent-1/50"
              }`}
            >
              All ({documents.length + marketSignals.length})
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-3 py-1.5 text-sm border-l border-accent-2 ${
                activeTab === "documents"
                  ? "bg-accent-1 text-white"
                  : "text-gray-400 hover:text-white hover:bg-accent-1/50"
              }`}
            >
              Documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab("signals")}
              className={`px-3 py-1.5 text-sm border-l border-accent-2 ${
                activeTab === "signals"
                  ? "bg-accent-1 text-white"
                  : "text-gray-400 hover:text-white hover:bg-accent-1/50"
              }`}
            >
              Market Signals ({marketSignals.length})
            </button>
          </div>
          <label className="px-4 py-2 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1 transition-colors cursor-pointer flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>{isUploading ? "Uploading..." : "Upload Document"}</span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt"
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {(activeTab === "all" || activeTab === "documents") &&
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-accent-1/50 border border-accent-2 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-400" />
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-green-400 transition-colors"
                >
                  {doc.name}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <DocumentPreview
                  url={doc.url}
                  name={doc.name}
                  type={doc.url.split(".").pop() || ""}
                />
                <button
                  onClick={() => handleDeleteDocument(doc.id, doc.url)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

        {(activeTab === "all" || activeTab === "signals") &&
          marketSignals.map((signal) => (
            <div
              key={signal.id}
              className="flex items-center justify-between p-3 bg-accent-1/50 border border-accent-2 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getSignalIcon(signal.source_type)}
                  <a
                    href={signal.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-green-400 transition-colors"
                  >
                    {signal.title}
                  </a>
                </div>
                <p className="text-sm text-gray-400">{signal.content}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{signal.source_name}</span>
                  <span>•</span>
                  <span>
                    {new Date(signal.publication_date).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span>Relevance: {signal.relevance_score}%</span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteSignal(signal.id)}
                className="ml-4 text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

        {((activeTab === "all" &&
          documents.length + marketSignals.length === 0) ||
          (activeTab === "documents" && documents.length === 0) ||
          (activeTab === "signals" && marketSignals.length === 0)) && (
          <div className="text-center text-gray-400 py-8">
            {activeTab === "documents"
              ? "No documents uploaded yet"
              : activeTab === "signals"
              ? "No market signals saved yet"
              : "No items in knowledge base yet"}
          </div>
        )}
      </div>
    </div>
  );
}
