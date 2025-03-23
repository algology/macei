import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  FileText,
  Plus,
  Calendar,
  AlertCircle,
  Trash2,
  ClipboardCopy,
  Check,
  Bookmark,
  Lightbulb,
  Globe,
  Search,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ideaId: number;
  ideaName: string;
  onInsightAdded?: () => void;
  onSwitchToInsights?: () => void;
  onIdeaUpdated?: () => void;
  onSwitchToAttributes?: () => void;
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
    emoji: string;
  }>;
  key_attributes: string[];
  created_at: string;
  suggested_signals?: string[];
}

interface UrlStatus {
  url: string;
  status: "reading" | "completed" | "error";
  domain: string;
}

export function BriefingNotes({
  ideaId,
  ideaName,
  onInsightAdded,
  onSwitchToInsights,
  onIdeaUpdated,
  onSwitchToAttributes,
}: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionPosition, setSelectionPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [savingInsight, setSavingInsight] = useState(false);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [suggestedSignals, setSuggestedSignals] = useState<string[]>([]);
  const [addingSignal, setAddingSignal] = useState(false);
  const [urlsBeingProcessed, setUrlsBeingProcessed] = useState<UrlStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);

  useEffect(() => {
    fetchBriefings();
  }, [ideaId]);

  useEffect(() => {
    // Add event listener for text selection
    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleTextSelection);
      document.removeEventListener("keydown", handleKeyDown);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Hide selection tooltip on Escape key
    if (e.key === "Escape" && selectionPosition) {
      setSelectionPosition(null);
      setSelectedText("");
    }
  };

  const handleTextSelection = () => {
    // Use a small timeout to ensure the selection is complete
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    selectionTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        const text = selection.toString().trim();
        setSelectedText(text);

        // Get the position for the tooltip
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position the tooltip above the selection
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
      } else {
        // Clear selection if clicked elsewhere
        setSelectionPosition(null);
        setSelectedText("");
      }
    }, 100);
  };

  async function saveSelectedTextAsInsight() {
    if (!selectedText) return;

    try {
      setSavingInsight(true);

      // Fetch current insights
      const { data, error: fetchError } = await supabase
        .from("ideas")
        .select("insights")
        .eq("id", ideaId)
        .single();

      if (fetchError) throw fetchError;

      const currentInsights = data?.insights || [];

      // Create new insight object
      const newInsightObj = {
        id: crypto.randomUUID(),
        content: selectedText,
        created_at: new Date().toISOString(),
        source: "briefing",
      };

      // Update insights in database
      const updatedInsights = [...currentInsights, newInsightObj];

      const { error: updateError } = await supabase
        .from("ideas")
        .update({ insights: updatedInsights })
        .eq("id", ideaId);

      if (updateError) throw updateError;

      // Clear selection
      setSelectionPosition(null);
      setSelectedText("");

      // Notify parent component to refresh insights
      if (onInsightAdded) {
        onInsightAdded();
      }

      // Show success message with Sonner toast
      toast.success("Insight saved successfully", {
        description: "The selected text has been saved as an insight.",
        icon: <Bookmark className="w-4 h-4" />,
        action: {
          label: "View Insights",
          onClick: () => {
            if (onSwitchToInsights) {
              onSwitchToInsights();
            }
          },
        },
      });
    } catch (error) {
      console.error("Error saving insight:", error);
      toast.error("Failed to save insight", {
        description: "Please try again.",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setSavingInsight(false);
    }
  }

  async function fetchBriefings() {
    try {
      setError(null);
      const { data, error } = await supabase
        .from("briefings")
        .select("*")
        .eq("idea_id", ideaId)
        .order("date_to", { ascending: false });

      if (error) throw error;

      // Process the briefings to ensure properly formatted data
      const processedBriefings = (data || []).map((briefing) => {
        // Handle suggested_signals if present
        if (briefing.suggested_signals) {
          // Update suggestedSignals state if this is the most recent briefing
          if (data && data.length > 0 && briefing.id === data[0].id) {
            setSuggestedSignals(
              Array.isArray(briefing.suggested_signals)
                ? briefing.suggested_signals.map((signal: any) =>
                    String(signal)
                  )
                : []
            );
          }
        }
        return briefing;
      });

      setBriefings(processedBriefings);
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
      setUrlsBeingProcessed([]);
      setSearchQuery(null);

      // Get the user session to include the auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

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

      // Setup event source for progress updates
      const eventSource = new EventSource(
        `/api/briefing-progress?ideaId=${ideaId}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "search") {
            setSearchQuery(data.query);
          } else if (data.type === "url") {
            // Add new URL or update existing URL status
            setUrlsBeingProcessed((prev) => {
              const exists = prev.some((item) => item.url === data.url);

              if (exists) {
                return prev.map((item) =>
                  item.url === data.url
                    ? { ...item, status: data.status }
                    : item
                );
              } else {
                // Extract domain from URL
                let domain = "";
                try {
                  domain = new URL(data.url).hostname.replace(/^www\./, "");
                } catch (e) {
                  domain =
                    data.url.split("/")[2]?.replace(/^www\./, "") || "unknown";
                }

                return [
                  ...prev,
                  {
                    url: data.url,
                    status: data.status,
                    domain,
                  },
                ];
              }
            });
          } else if (data.type === "complete") {
            // Close event source and refresh
            eventSource.close();
            fetchBriefings();
            setGenerating(false);
            setIsDialogOpen(false);
          }
        } catch (error) {
          console.error("Error parsing event data", error);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

      // Call your API endpoint with the auth token
      const response = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ideaId,
          ideaName,
        }),
      });

      if (!response.ok) {
        eventSource.close();
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate briefing");
      }

      const data = await response.json();

      // Set suggested signals from the response if available
      if (data.suggested_signals && Array.isArray(data.suggested_signals)) {
        setSuggestedSignals(
          data.suggested_signals.map((signal: unknown) => String(signal))
        );
      }

      // Refresh the briefings list
      await fetchBriefings();

      // Close the event source - although it should already be closed
      eventSource.close();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error generating briefing:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
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

      // Show success message
      toast.success("Briefing deleted", {
        description: "The briefing has been removed.",
      });
    } catch (error) {
      console.error("Error deleting briefing:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete briefing"
      );

      toast.error("Failed to delete briefing", {
        description:
          error instanceof Error ? error.message : "Please try again.",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setDeleting(null);
    }
  }

  function copyToClipboard(briefing: Briefing) {
    const content = `Environment Briefing Note
Date Range: ${new Date(briefing.date_from).toLocaleDateString()} - ${new Date(
      briefing.date_to
    ).toLocaleDateString()}
Created: ${new Date(briefing.created_at).toLocaleDateString()}

Impact on Idea Conviction:
${briefing.impact_analysis}

Summary:
${briefing.summary}

Details:
${briefing.details
  .map(
    (detail) => `${detail.emoji} - ${detail.summary}
Source: ${detail.url}`
  )
  .join("\n\n")}

Key Attributes:
${briefing.key_attributes.join(", ")}`;

    navigator.clipboard
      .writeText(content)
      .then(() => {
        toast.success("Copied to clipboard", {
          description: "Briefing content has been copied to your clipboard.",
          icon: <ClipboardCopy className="w-4 h-4" />,
        });
      })
      .catch((error) => {
        console.error("Error copying to clipboard:", error);
        toast.error("Failed to copy to clipboard", {
          description: "Please try again.",
          icon: <AlertCircle className="w-4 h-4" />,
        });
      });
  }

  async function addSignalToIdea(signal: string) {
    try {
      setAddingSignal(true);

      // First get current signals
      const { data: ideaData, error: ideaError } = await supabase
        .from("ideas")
        .select("signals")
        .eq("id", ideaId)
        .single();

      if (ideaError) throw ideaError;

      // Parse current signals
      let currentSignals: string[] = [];
      try {
        if (ideaData.signals) {
          const parsed = JSON.parse(ideaData.signals);
          if (Array.isArray(parsed)) {
            currentSignals = parsed;
          } else if (typeof parsed === "object") {
            // Handle case where signals might be stored as an object
            currentSignals = Object.values(parsed).flat() as string[];
          }
        }
      } catch (e) {
        // If parsing fails, try splitting by comma
        currentSignals = ideaData.signals
          ? ideaData.signals.split(",").map((s: string) => s.trim())
          : [];
      }

      // Add the new signal if it doesn't already exist
      if (!currentSignals.includes(signal)) {
        currentSignals.push(signal);

        // Update the idea with the new signals
        const { error: updateError } = await supabase
          .from("ideas")
          .update({
            signals: JSON.stringify(currentSignals),
          })
          .eq("id", ideaId);

        if (updateError) throw updateError;

        // Remove from suggested signals
        setSuggestedSignals(suggestedSignals.filter((s) => s !== signal));

        toast.success(`Added "${signal}" to idea attributes`);

        // Notify parent components of the update
        if (onIdeaUpdated) {
          onIdeaUpdated();
        }

        // Navigate to the attributes tab instead of insights
        // Check if parent has defined a way to navigate to attributes tab
        if (onSwitchToAttributes) {
          onSwitchToAttributes();
        }
      } else {
        toast.info(`"${signal}" is already in your idea attributes`);
      }
    } catch (error) {
      console.error("Error adding signal:", error);
      toast.error("Failed to add signal to idea attributes");
    } finally {
      setAddingSignal(false);
    }
  }

  // Helper function to get favicon URL for a domain
  const getFaviconUrl = (domain: string) => {
    return `https://www.google.com/s2/favicons?sz=128&domain=https://${domain}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Selection tooltip */}
      {selectionPosition && (
        <div
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full selection-tooltip"
          style={{
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
          }}
        >
          <div className="bg-accent-1 border border-accent-2 rounded-lg shadow-lg p-2 flex items-center gap-2">
            <button
              onClick={saveSelectedTextAsInsight}
              disabled={savingInsight}
              className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-900 rounded-md hover:bg-green-500/30 transition-colors flex items-center gap-2 text-sm"
            >
              {savingInsight ? (
                <LoadingSpinner className="w-3 h-3" />
              ) : (
                <Bookmark className="w-3 h-3" />
              )}
              Save Insight
            </button>
          </div>
          <div className="w-3 h-3 bg-accent-1 border-r border-b border-accent-2 transform rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(briefing)}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Copy to clipboard"
                    >
                      <ClipboardCopy className="w-4 h-4" />
                    </button>
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
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">
                    Impact on Idea Conviction
                  </h5>
                  <div className="bg-accent-1/50 rounded p-3 text-sm text-gray-300 selectable-text">
                    {briefing.impact_analysis}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Summary</h5>
                  <div className="bg-accent-1/50 rounded p-3 text-sm text-gray-300 selectable-text">
                    {briefing.summary}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Details</h5>
                  <div className="space-y-3">
                    {briefing.details.map((detail, index) => (
                      <div
                        key={index}
                        className="bg-accent-1/50 rounded p-3 text-sm text-gray-300 selectable-text"
                      >
                        <div className="flex items-start gap-2">
                          <span>{detail.emoji}</span>
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
                  <h5 className="text-sm font-medium mb-2">
                    Key Attributes Used
                  </h5>
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

              {suggestedSignals.length > 0 &&
                briefings[0]?.id === briefing.id && (
                  <div className="mt-6 pt-4 border-t border-accent-2">
                    <h5 className="text-base font-medium mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      Suggested New Market Signals
                    </h5>
                    <p className="text-sm text-gray-400 mb-3">
                      These signals were identified as potentially relevant to
                      your idea. Click to add them to your idea attributes.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedSignals.map((signal, index) => (
                        <button
                          key={index}
                          onClick={() => addSignalToIdea(signal)}
                          disabled={addingSignal}
                          className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors text-sm flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          {signal}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] max-h-[80vh] overflow-y-auto bg-background border border-accent-2 rounded-lg shadow-lg p-4">
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

            {/* Progress UI */}
            {generating && (
              <div className="space-y-4 mb-4 bg-accent-1/30 rounded-lg p-4 border border-accent-2">
                <div className="flex items-center gap-2">
                  <LoadingSpinner className="w-4 h-4" />
                  <p className="text-sm text-gray-300">
                    Generating briefing...
                  </p>
                </div>

                {searchQuery && (
                  <div className="mt-1.5">
                    <div className="mb-1 text-xs text-gray-400">
                      <span>Searching</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="py-1 px-2.5 pl-2 rounded-lg bg-accent-1/50 text-xs font-mono flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5" />
                        <p className="text-[0.68rem] leading-4">
                          {searchQuery}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {urlsBeingProcessed.length > 0 && (
                  <div className="mt-1.5">
                    <div className="mb-1 text-xs text-gray-400">
                      <span>Reading</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {urlsBeingProcessed.map((urlStatus, idx) => (
                        <a
                          key={idx}
                          href={urlStatus.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1 pl-1.5 pr-2.5 rounded-lg bg-accent-1/50 hover:bg-accent-1/70 transition-colors duration-300"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-none">
                              <div className="relative overflow-hidden rounded-full">
                                <div className="rounded-inherit absolute inset-0 bg-white"></div>
                                <img
                                  className="relative block"
                                  alt={`${urlStatus.domain} favicon`}
                                  width="16"
                                  height="16"
                                  src={getFaviconUrl(urlStatus.domain)}
                                  style={{ width: "16px", height: "16px" }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "/favicon.ico";
                                  }}
                                />
                                <div className="rounded-inherit absolute inset-0 border border-[rgba(0,0,0,0.1)] dark:border-transparent"></div>
                              </div>
                            </div>
                            <div className="line-clamp-1 break-all text-[0.7rem] font-mono">
                              {urlStatus.domain}
                            </div>
                            {urlStatus.status === "reading" && (
                              <LoadingSpinner className="w-3 h-3 ml-0.5" />
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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
