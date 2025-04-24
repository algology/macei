import { useState, useEffect } from "react";
import {
  Upload,
  File,
  Trash2,
  Newspaper,
  Book,
  Lightbulb,
  Eye,
  EyeOff,
} from "lucide-react";
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
  const [expandedSignals, setExpandedSignals] = useState<{
    [key: number]: boolean;
  }>({});

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

  const toggleExpandSignal = (signalId: number) => {
    setExpandedSignals((prev) => ({
      ...prev,
      [signalId]: !prev[signalId],
    }));
  };

  return (
    <div
      data-component="knowledge-base"
      className="space-y-4"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Knowledge Base</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer bg-accent-1/50 hover:bg-accent-1/70 border border-accent-2 rounded-md px-3 py-1.5 text-sm flex items-center gap-2 transition-colors"
            >
              {isUploading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload Document
            </label>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            activeTab === "all"
              ? "bg-green-500/20 text-green-400 border border-green-900"
              : "bg-accent-1/50 text-gray-400 border border-accent-2 hover:bg-accent-1/70"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            activeTab === "documents"
              ? "bg-green-500/20 text-green-400 border border-green-900"
              : "bg-accent-1/50 text-gray-400 border border-accent-2 hover:bg-accent-1/70"
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab("signals")}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            activeTab === "signals"
              ? "bg-green-500/20 text-green-400 border border-green-900"
              : "bg-accent-1/50 text-gray-400 border border-accent-2 hover:bg-accent-1/70"
          }`}
        >
          Market Signals
        </button>
      </div>

      <div className="space-y-3">
        {/* Documents Section */}
        {(activeTab === "all" || activeTab === "documents") && documents.length > 0 && (
          <div className="bg-accent-1/30 border border-accent-2 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Documents</h4>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 bg-accent-1/50 border border-accent-2 rounded-md hover:bg-accent-1/70 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <File className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:text-green-400 transition-colors truncate"
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
            </div>
          </div>
        )}

        {/* Market Signals Section */}
        {(activeTab === "all" || activeTab === "signals") && marketSignals.length > 0 && (
          <div className="bg-accent-1/30 border border-accent-2 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Market Signals</h4>
            <div className="space-y-2">
              {marketSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="p-3 bg-accent-1/50 border border-accent-2 rounded-md hover:bg-accent-1/70 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-accent-1/70 p-1 rounded-md">
                        {getSignalIcon(signal.source_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <a
                            href={signal.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:text-green-400 transition-colors"
                          >
                            {signal.title}
                          </a>
                          <button
                            onClick={() => handleDeleteSignal(signal.id)}
                            className="ml-2 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <span className="bg-accent-2/50 px-1.5 py-0.5 rounded-full">
                            {signal.source_type === "news" ? "News" : 
                             signal.source_type === "academic" ? "Academic" : 
                             signal.source_type === "patent" ? "Patent" : "Other"}
                          </span>
                          <span>{signal.source_name}</span>
                          <span>•</span>
                          <span>
                            {new Date(signal.publication_date).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                            {signal.relevance_score}% Relevance
                          </span>
                        </div>
                      </div>
                    </div>
                    {signal.metadata?.is_user_submitted &&
                    signal.content.length > 200 ? (
                      <div className="text-sm text-gray-400 mt-2 pl-7">
                        <p>
                          {expandedSignals[signal.id]
                            ? signal.content
                            : signal.content.substring(0, 200) + "..."}
                        </p>
                        <button
                          onClick={() => toggleExpandSignal(signal.id)}
                          className="flex items-center gap-1 mt-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {expandedSignals[signal.id] ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span className="text-xs">Show less</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span className="text-xs">Show more</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mt-2 pl-7">{signal.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty States */}
        {((activeTab === "all" &&
          documents.length + marketSignals.length === 0) ||
          (activeTab === "documents" && documents.length === 0) ||
          (activeTab === "signals" && marketSignals.length === 0)) && (
          <div className="text-center text-gray-400 py-8 bg-accent-1/30 border border-accent-2 rounded-lg">
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
