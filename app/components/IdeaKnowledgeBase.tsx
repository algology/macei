import { useState, useEffect } from "react";
import { Upload, File, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Document } from "./types";

interface Props {
  ideaId: number;
  onDocumentAdded: () => void;
}

export function IdeaKnowledgeBase({ ideaId, onDocumentAdded }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [ideaId]);

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

  async function handleDelete(documentId: number, url: string) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Knowledge Base</h3>
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

      <div className="space-y-2">
        {documents.map((doc) => (
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
            <button
              onClick={() => handleDelete(doc.id, doc.url)}
              className="text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
