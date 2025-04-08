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
  ExternalLink,
  Globe2,
  ListChecks,
  ChevronRight,
  Download,
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
}

interface Briefing {
  id: number;
  idea_id: number;
  date_from: string;
  date_to: string;
  summary: string;
  details: Array<{
    summary: string;
    url: string;
    emoji: string;
    source_name?: string;
  }>;
  key_attributes: string[];
  created_at: string;
  suggested_signals?: string[];
  next_steps?: string[];
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
  const [savingPdfId, setSavingPdfId] = useState<number | null>(null);

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
      // Reset states
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

      // First verify the idea exists with all needed fields
      interface IdeaWithDetails {
        id: number;
        category?: string;
        signals?: string;
        ai_analysis?: string;
        mission?: {
          name?: string;
          organization?: {
            name?: string;
          };
        };
      }

      const { data: idea, error: ideaError } = await supabase
        .from("ideas")
        .select(
          `
          id,
          category,
          signals,
          ai_analysis,
          mission:missions (
            name,
            organization:organizations (
              name
            )
          )
        `
        )
        .eq("id", ideaId)
        .single();

      if (ideaError) {
        throw new Error("Failed to verify idea exists");
      }

      if (!idea) {
        throw new Error("Idea not found");
      }

      // Type cast to ensure TypeScript knows the shape
      const ideaWithDetails = idea as unknown as IdeaWithDetails;

      // Simulate initial search query being processed
      setSearchQuery(`${ideaName} market trends and recent developments`);

      // First call the API to get the actual process started
      const apiResponse = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ideaId,
          ideaName,
          isAutomatic: false, // Manual generation doesn't need notifications
        }),
      });

      // Log to console to help with debugging
      console.log(
        "Sending generate briefing request with isAutomatic=false (user-initiated)"
      );

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate briefing");
      }

      // After API call is started, fetch market signals to show real URLs
      try {
        const signalsResponse = await fetch("/api/fetch-market-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ideaName,
            category: ideaWithDetails.category,
            signals: ideaWithDetails.signals,
            missionName: ideaWithDetails.mission?.name,
            organizationName: ideaWithDetails.mission?.organization?.name,
            aiAnalysis: ideaWithDetails.ai_analysis,
          }),
        });

        if (signalsResponse.ok) {
          const signalsData = await signalsResponse.json();
          const signals = signalsData.signals;

          if (signals) {
            // Collect all URLs from different signal types
            const allUrls = [
              ...(signals.news || []),
              ...(signals.academic || []),
              ...(signals.patents || []),
              ...(signals.trends || []),
              ...(signals.competitors || []),
              ...(signals.industry || []),
              ...(signals.funding || []),
            ]
              .filter((signal) => signal.url && signal.url.startsWith("http"))
              .slice(0, 8); // Limit to a reasonable number

            // Animate showing these URLs being processed
            for (const signal of allUrls) {
              // Extract domain for display
              let domain = "";
              try {
                domain = new URL(signal.url).hostname.replace(/^www\./, "");
              } catch (e) {
                domain =
                  signal.url.split("/")[2]?.replace(/^www\./, "") || "unknown";
              }

              // Add URL as "reading"
              setUrlsBeingProcessed((prev) => [
                ...prev,
                {
                  url: signal.url,
                  domain,
                  status: "reading",
                },
              ]);

              // Wait a moment to simulate reading
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Update to "completed"
              setUrlsBeingProcessed((prev) =>
                prev.map((item) =>
                  item.url === signal.url
                    ? { ...item, status: "completed" }
                    : item
                )
              );

              // Small delay between URLs
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching market signals:", error);
        // Continue with generation even if this fails
      }

      const data = await apiResponse.json();

      // Set suggested signals from the response if available
      if (data.suggested_signals && Array.isArray(data.suggested_signals)) {
        setSuggestedSignals(
          data.suggested_signals.map((signal: unknown) => String(signal))
        );
      }

      // Refresh the briefings list
      await fetchBriefings();

      // Cleanup
      setGenerating(false);
      setIsDialogOpen(false);
      setUrlsBeingProcessed([]);
      setSearchQuery(null);
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
    const content = `Environment Briefing Note for ${ideaName}
Date Range: ${new Date(briefing.date_from).toLocaleDateString()} - ${new Date(
      briefing.date_to
    ).toLocaleDateString()}
Created: ${new Date(briefing.created_at).toLocaleDateString()}

Summary:
${briefing.summary}

Details:
${briefing.details
  .map(
    (detail) => `${detail.emoji} - ${detail.summary}
Source: ${detail.source_name || extractDomainFromUrl(detail.url)} (${
      detail.url
    })`
  )
  .join("\n\n")}

Key Attributes:
${briefing.key_attributes.join(", ")}${
      briefing.suggested_signals && briefing.suggested_signals.length > 0
        ? `

Suggested New Idea Attributes:
${briefing.suggested_signals.join(", ")}`
        : ""
    }${
      briefing.next_steps && briefing.next_steps.length > 0
        ? `

Recommended Next Steps:
${briefing.next_steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`
        : ""
    }`;

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

  const extractDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "").split(".");
      if (domain.length >= 2) {
        // Capitalize first letter of domain name
        return (
          domain[domain.length - 2].charAt(0).toUpperCase() +
          domain[domain.length - 2].slice(1)
        );
      }
      return urlObj.hostname.replace(/^www\./, "");
    } catch (e) {
      return "Source";
    }
  };

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
    // Use Google's favicon service for consistent cross-environment behavior
    // The double-encoding ensures special characters are properly handled
    const encodedDomain = encodeURIComponent(`https://${domain}`);
    return `https://www.google.com/s2/favicons?domain=${encodedDomain}&sz=32`;
  };

  // Helper function to render favicon with fallback
  const renderFavicon = (domain: string) => {
    return (
      <div className="relative flex-none">
        <div className="relative overflow-hidden rounded-full">
          <div className="rounded-inherit absolute inset-0 bg-white"></div>
          <img
            className="relative block w-4 h-4 z-10"
            alt={`${domain} favicon`}
            src={getFaviconUrl(domain)}
            style={{ objectFit: "contain" }}
            onError={(e) => {
              // If favicon fails to load, show the fallback icon
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.nextElementSibling?.classList.remove("hidden");
            }}
          />
          {/* Fallback icon for when favicon fails to load */}
          <div className="absolute inset-0 bg-gray-500 text-white items-center justify-center hidden">
            <Globe2 className="w-3 h-3" />
          </div>
          <div className="rounded-inherit absolute inset-0 border border-[rgba(0,0,0,0.1)] dark:border-transparent"></div>
        </div>
      </div>
    );
  };

  // Function to save a specific briefing note as PDF (server-side)
  async function saveAsPdf(briefingId: number) {
    try {
      setSavingPdfId(briefingId);

      // Get the current session to include the access token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be logged in to generate a PDF");
      }

      // Call the server-side API route to generate the PDF
      const response = await fetch("/api/generate-briefing-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ briefingId }),
        credentials: "include", // Include cookies for authentication
      });

      if (!response.ok) {
        // If unauthorized, show a more specific error
        if (response.status === 401) {
          throw new Error(
            "Authentication failed. Please try logging in again."
          );
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a download link and click it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "briefing.pdf";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Briefing note saved as PDF.", {
        description: "The PDF contains selectable text and proper formatting.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to save briefing note as PDF.", {
        description:
          error instanceof Error ? error.message : "Please try again.",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setSavingPdfId(null);
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
              id={`briefing-note-${briefing.id}`}
              className="bg-accent-1/30 rounded-lg border border-accent-2 p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <h4 className="font-medium">
                      Environment Briefing Note:{" "}
                      <span className="text-gray-400">
                        {new Date(briefing.date_from).toLocaleDateString()} -{" "}
                        {new Date(briefing.date_to).toLocaleDateString()}
                      </span>
                    </h4>
                    <div className="mt-1">
                      <span className="inline-flex items-center bg-green-500/10 text-green-400 border border-green-900 px-2 py-0.5 rounded-md text-sm">
                        {ideaName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {new Date(briefing.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(briefing)}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Copy to clipboard"
                    >
                      <ClipboardCopy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => saveAsPdf(briefing.id)}
                      disabled={savingPdfId === briefing.id}
                      className="p-2 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                      title="Save as PDF"
                    >
                      {savingPdfId === briefing.id ? (
                        <LoadingSpinner className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
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
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-xs text-gray-400">
                                Source:
                              </span>
                              <a
                                href={detail.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-400 hover:text-green-300 text-sm inline-flex items-center gap-1"
                              >
                                {(() => {
                                  // Extract domain name from URL to use as fallback source name
                                  let sourceName = "Read More";
                                  try {
                                    if (detail.url) {
                                      // Use source_name if available, otherwise extract from URL
                                      if (detail.source_name) {
                                        sourceName = detail.source_name;
                                      } else {
                                        const urlObj = new URL(detail.url);
                                        const domain = urlObj.hostname
                                          .replace(/^www\./, "")
                                          .split(".");
                                        if (domain.length >= 2) {
                                          // Capitalize first letter of domain name
                                          sourceName =
                                            domain[domain.length - 2]
                                              .charAt(0)
                                              .toUpperCase() +
                                            domain[domain.length - 2].slice(1);
                                        }
                                      }
                                    }
                                  } catch (e) {
                                    console.error(
                                      "Error extracting domain:",
                                      e
                                    );
                                  }
                                  return sourceName;
                                })()}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Next Steps Section */}
              {briefing.next_steps && briefing.next_steps.length > 0 && (
                <div className="mt-6">
                  <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-400" />
                    Recommended Next Steps
                  </h5>
                  <div className="space-y-2">
                    {briefing.next_steps.map((step, index) => (
                      <div
                        key={index}
                        className="bg-blue-900/10 text-blue-200 border border-blue-800/30 rounded-lg p-3 text-sm flex items-start gap-2.5 group transition-colors hover:bg-blue-900/20"
                      >
                        <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 group-hover:translate-x-1 transition-transform" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestedSignals.length > 0 &&
                briefings[0]?.id === briefing.id && (
                  <div className="mt-6 pt-4 border-t border-accent-2">
                    <h5 className="text-base font-medium mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      Suggested New Idea Attributes
                    </h5>
                    <p className="text-sm text-gray-400 mb-3">
                      These attributes were identified as relevant to your idea.
                      Click them to your inform your next briefing.
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
              {/* Key Attributes section moved here and styled with gray instead of green */}
              <div className="mt-4">
                <h5 className="text-xs font-medium mb-2 text-gray-400">
                  Key Attributes Used for This Briefing
                </h5>
                <div className="flex flex-wrap gap-2">
                  {briefing.key_attributes.map((attribute, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center bg-gray-500/10 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-md text-xs"
                    >
                      {attribute}
                    </span>
                  ))}
                </div>
              </div>
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
                {searchQuery && (
                  <div>
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
                  <div className={searchQuery ? "mt-3" : ""}>
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
                            {renderFavicon(urlStatus.domain)}
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
                    Working...
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
