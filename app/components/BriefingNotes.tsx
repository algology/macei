import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import { FileText, Plus, Calendar, AlertCircle, Trash2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface Props {
  ideaId: number;
  ideaName: string;
}

interface Briefing {
  id: number;
  idea_id: number;
  date_from: string;
  date_to: string;
  impact_analysis: string;
  summary: string;
  details: Array<{
    summary: string;
    url: string;
    country: string;
  }>;
  key_attributes: string[];
  created_at: string;
}

export function BriefingNotes({ ideaId, ideaName }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetchBriefings();
  }, [ideaId]);

  async function fetchBriefings() {
    try {
      setError(null);
      const { data, error } = await supabase
        .from("briefings")
        .select("*")
        .eq("idea_id", ideaId)
        .order("date_to", { ascending: false });

      if (error) throw error;

      setBriefings(data || []);
    } catch (error) {
      console.error("Error fetching briefings:", error);
      setError("Failed to fetch briefings");
    } finally {
      setLoading(false);
    }
  }

  async function generateBriefing() {
    try {
      setError(null);
      setGenerating(true);

      // First verify the idea exists
      const { data: idea, error: ideaError } = await supabase
        .from("ideas")
        .select("id")
        .eq("id", ideaId)
        .single();

      if (ideaError) {
        throw new Error("Failed to verify idea exists");
      }

      if (!idea) {
        throw new Error("Idea not found");
      }

      // Call your API endpoint that will use the LLM to generate the briefing
      const response = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          ideaName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate briefing");
      }

      const data = await response.json();

      // Refresh the briefings list
      await fetchBriefings();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error generating briefing:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate briefing"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function deleteBriefing(briefingId: number) {
    try {
      setDeleting(briefingId);
      setError(null);

      const response = await fetch("/api/delete-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefingId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete briefing");
      }

      // Remove the briefing from the local state
      setBriefings((prev) => prev.filter((b) => b.id !== briefingId));
    } catch (error) {
      console.error("Error deleting briefing:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete briefing"
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Briefing Notes</h3>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Generate Briefing
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-900 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {!error && briefings.length === 0 ? (
        <div className="text-gray-400 text-center py-12">
          No briefings generated yet. Click the button above to create your
          first briefing.
        </div>
      ) : (
        <div className="space-y-6">
          {briefings.map((briefing) => (
            <div
              key={briefing.id}
              className="bg-accent-1/30 rounded-lg border border-accent-2 p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <h4 className="font-medium">
                    Environment Briefing Note:{" "}
                    <span className="text-gray-400">
                      {new Date(briefing.date_from).toLocaleDateString()} -{" "}
                      {new Date(briefing.date_to).toLocaleDateString()}
                    </span>
                  </h4>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {new Date(briefing.created_at).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => deleteBriefing(briefing.id)}
                    disabled={deleting === briefing.id}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    title="Delete briefing"
                  >
                    {deleting === briefing.id ? (
                      <LoadingSpinner className="w-4 h-4" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">
                    Impact on Idea Conviction
                  </h5>
                  <div className="bg-accent-1/50 rounded p-3 text-sm text-gray-300">
                    {briefing.impact_analysis}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Summary</h5>
                  <div className="bg-accent-1/50 rounded p-3 text-sm text-gray-300">
                    {briefing.summary}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Details</h5>
                  <div className="space-y-3">
                    {briefing.details.map((detail, index) => (
                      <div
                        key={index}
                        className="bg-accent-1/50 rounded p-3 text-sm text-gray-300"
                      >
                        <div className="flex items-start gap-2">
                          <span>{detail.country}</span>
                          <div>
                            <p>{detail.summary}</p>
                            <a
                              href={detail.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-400 hover:text-green-300 text-sm mt-1 inline-block"
                            >
                              Read More
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Key Attributes</h5>
                  <div className="flex flex-wrap gap-2">
                    {briefing.key_attributes.map((attribute, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center bg-green-500/20 text-green-400 border border-green-900 px-2 py-1 rounded-md text-sm"
                      >
                        {attribute}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-background border border-accent-2 rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">
                Generate Briefing Note
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-300">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <Dialog.Description className="text-sm text-gray-400 mb-4">
              Generate a new briefing note for your idea. This will analyze
              recent developments and provide insights about your idea's
              environment.
            </Dialog.Description>

            {error && (
              <div className="bg-red-500/10 text-red-400 border border-red-900 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={generateBriefing}
                disabled={generating}
                className="w-full px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate Briefing
                  </>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
