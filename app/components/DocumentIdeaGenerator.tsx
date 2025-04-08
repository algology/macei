import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  FileText,
  Check,
  XCircle,
  Loader2,
  AlertCircle,
  Brain,
  Quote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Idea } from "./types";
import { IdeaAttributesDialog } from "./IdeaAttributesDialog";

interface ExtractedIdea {
  name: string;
  summary: string;
  source_text: string;
  idea_attributes: string[];
  location: string;
  is_explicit: boolean;
  selected: boolean;
}

interface SuggestedIdea {
  name: string;
  summary: string;
  idea_attributes: string[];
  rationale: string;
  is_ai_suggested: boolean;
  selected: boolean;
}

interface Props {
  missionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onIdeasCreated: (ideas: Idea[]) => void;
}

export function DocumentIdeaGenerator({
  missionId,
  isOpen,
  onOpenChange,
  onIdeasCreated,
}: Props) {
  const [documentContent, setDocumentContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractedIdeas, setExtractedIdeas] = useState<ExtractedIdea[]>([]);
  const [suggestedIdeas, setSuggestedIdeas] = useState<SuggestedIdea[]>([]);
  const [documentSummary, setDocumentSummary] = useState("");
  const [showAttributesDialog, setShowAttributesDialog] = useState(false);
  const [createdIdea, setCreatedIdea] = useState<Idea | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"extracted" | "suggested">(
    "extracted"
  );
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Maximum document length (approximately 8k tokens, which is ~32k characters)
  const MAX_DOCUMENT_LENGTH = 30000;

  // Get the current user's ID when the component mounts
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      }
    };

    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog is closed
      setDocumentContent("");
      setIsGenerating(false);
      setExtractedIdeas([]);
      setSuggestedIdeas([]);
      setDocumentSummary("");
      setError(null);
      setActiveTab("extracted");
      setIsSummaryExpanded(false);
    }
  }, [isOpen]);

  // Log when selection changes to debug
  useEffect(() => {
    console.log(
      "Extracted ideas selection state:",
      extractedIdeas.map((idea) => ({
        name: idea.name,
        selected: idea.selected,
      }))
    );
  }, [extractedIdeas]);

  useEffect(() => {
    console.log(
      "Suggested ideas selection state:",
      suggestedIdeas.map((idea) => ({
        name: idea.name,
        selected: idea.selected,
      }))
    );
  }, [suggestedIdeas]);

  async function handleGenerateIdeas(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      // Get mission data with organization for context
      const { data: missionData, error: missionError } = await supabase
        .from("missions")
        .select("*, organization:organizations(*)")
        .eq("id", missionId)
        .single();

      if (missionError) {
        throw new Error(
          `Failed to fetch mission data: ${missionError.message}`
        );
      }

      // Call the API to analyze the document and extract ideas
      try {
        const response = await fetch("/api/generate-ideas-from-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization: missionData?.organization?.name,
            mission: missionData?.name,
            mission_description: missionData?.description,
            documentContent,
          }),
        });

        let responseData;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          console.error("Error parsing JSON response:", jsonError);
          throw new Error("Failed to parse response from server");
        }

        if (!response.ok) {
          throw new Error(
            responseData.error ||
              `Failed to generate ideas: Server returned ${response.status}`
          );
        }

        // Log the raw response for debugging
        console.log(
          "Raw response data:",
          JSON.stringify(responseData, null, 2)
        );

        // Validate response data structure
        if (!responseData.content) {
          console.error(
            "Invalid response format - missing content:",
            responseData
          );
          throw new Error("Invalid response format from server");
        }

        // Extract extracted_ideas, adding validation and debugging
        const extractedIdeasRaw = responseData.content.extracted_ideas;
        console.log("Extracted ideas raw:", extractedIdeasRaw);

        if (!Array.isArray(extractedIdeasRaw)) {
          console.error("extracted_ideas is not an array:", extractedIdeasRaw);
          throw new Error(
            "Invalid data format: extracted_ideas is not an array"
          );
        }

        // Add selected property to each extracted idea
        const extractedWithSelection = extractedIdeasRaw
          .map((idea: Omit<ExtractedIdea, "selected">) => {
            // Validate the idea object
            if (!idea || typeof idea !== "object") {
              console.error("Invalid idea object in extracted_ideas:", idea);
              return null;
            }

            return {
              ...idea,
              name: idea.name || "Unnamed Idea",
              summary: idea.summary || "No summary provided",
              selected: true,
              // Ensure idea_attributes is an array and has values
              idea_attributes:
                Array.isArray(idea.idea_attributes) &&
                idea.idea_attributes.length > 0
                  ? idea.idea_attributes
                  : ["General"],
              // Ensure required fields are present
              source_text: idea.source_text || "No source text provided",
              location: idea.location || "Unknown location",
              is_explicit:
                typeof idea.is_explicit === "boolean" ? idea.is_explicit : true,
            };
          })
          .filter(Boolean) as ExtractedIdea[];

        // Extract suggested_ideas with validation
        const suggestedIdeasRaw = responseData.content.suggested_ideas;
        console.log("Suggested ideas raw:", suggestedIdeasRaw);

        // Add selected property to each suggested idea
        const suggestedWithSelection = Array.isArray(suggestedIdeasRaw)
          ? (suggestedIdeasRaw
              .map((idea: Omit<SuggestedIdea, "selected">) => {
                // Validate the idea object
                if (!idea || typeof idea !== "object") {
                  console.error(
                    "Invalid idea object in suggested_ideas:",
                    idea
                  );
                  return null;
                }

                return {
                  ...idea,
                  name: idea.name || "Unnamed Suggested Idea",
                  summary: idea.summary || "No summary provided",
                  selected: true,
                  // Ensure idea_attributes is an array and has values
                  idea_attributes:
                    Array.isArray(idea.idea_attributes) &&
                    idea.idea_attributes.length > 0
                      ? idea.idea_attributes
                      : ["General"],
                  // Ensure required fields are present
                  rationale: idea.rationale || "Based on document content",
                  is_ai_suggested: true,
                };
              })
              .filter(Boolean) as SuggestedIdea[])
          : [];

        setExtractedIdeas(extractedWithSelection);
        setSuggestedIdeas(suggestedWithSelection);
        setDocumentSummary(responseData.documentSummary || "");

        // Log the results
        console.log(
          `Loaded ${extractedWithSelection.length} extracted ideas and ${suggestedWithSelection.length} suggested ideas`
        );

        // If no ideas were found, show a warning
        if (
          extractedWithSelection.length === 0 &&
          suggestedWithSelection.length === 0
        ) {
          setError(
            "No ideas could be found in or generated from this document. Try a document with more explicit idea descriptions."
          );
        }
      } catch (apiError) {
        console.error("API Error:", apiError);
        throw apiError;
      }
    } catch (error) {
      console.error("Error generating ideas:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate ideas - please try again with a different document"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmitSelectedIdeas() {
    setIsSubmitting(true);
    setError(null);

    try {
      const selectedExtracted = extractedIdeas.filter((idea) => idea.selected);
      const selectedSuggested = suggestedIdeas.filter((idea) => idea.selected);
      const totalSelected = selectedExtracted.length + selectedSuggested.length;

      if (totalSelected === 0) {
        throw new Error("No ideas selected for submission");
      }

      const createdIdeas: Idea[] = [];

      // Create each selected extracted idea
      for (const idea of selectedExtracted) {
        const { data, error } = await supabase
          .from("ideas")
          .insert([
            {
              name: idea.name,
              mission_id: missionId,
              summary:
                idea.summary +
                (idea.source_text ? `\n\nSource: "${idea.source_text}"` : ""),
              status: "ideation",
              user_id: userId,
              signals: JSON.stringify(idea.idea_attributes),
            },
          ])
          .select()
          .single();

        if (error) throw error;
        createdIdeas.push(data);
      }

      // Create each selected AI-suggested idea
      for (const idea of selectedSuggested) {
        const { data, error } = await supabase
          .from("ideas")
          .insert([
            {
              name: `[AI Suggested] ${idea.name}`,
              mission_id: missionId,
              summary: idea.summary + "\n\nRationale: " + idea.rationale,
              status: "ideation",
              user_id: userId,
              signals: JSON.stringify(idea.idea_attributes),
            },
          ])
          .select()
          .single();

        if (error) throw error;
        createdIdeas.push(data);
      }

      // Close dialog and notify parent
      onOpenChange(false);
      onIdeasCreated(createdIdeas);
    } catch (error) {
      console.error("Error submitting ideas:", error);
      setError(
        error instanceof Error ? error.message : "Failed to submit ideas"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleExtractedIdeaSelection = (index: number) => {
    const newIdeas = [...extractedIdeas];
    newIdeas[index] = {
      ...newIdeas[index],
      selected: !newIdeas[index].selected,
    };
    setExtractedIdeas(newIdeas);
    console.log(
      `Toggled extracted idea ${index} to ${!extractedIdeas[index].selected}`
    );
  };

  const toggleSuggestedIdeaSelection = (index: number) => {
    const newIdeas = [...suggestedIdeas];
    newIdeas[index] = {
      ...newIdeas[index],
      selected: !newIdeas[index].selected,
    };
    setSuggestedIdeas(newIdeas);
    console.log(
      `Toggled suggested idea ${index} to ${!suggestedIdeas[index].selected}`
    );
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] max-h-[80vh] overflow-y-auto bg-background border border-accent-2 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              Generate Ideas from Document
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-300">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-400 mb-4">
            Paste your document content below to automatically extract and
            generate innovation ideas.
          </Dialog.Description>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-900 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          {!extractedIdeas.length && !suggestedIdeas.length ? (
            <form onSubmit={handleGenerateIdeas}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="documentContent"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Document Content
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    Paste the content of your document. The system will analyze
                    it to extract all potential innovation ideas mentioned in
                    the text, as well as suggest a few complementary ideas.
                  </p>
                  <textarea
                    id="documentContent"
                    value={documentContent}
                    onChange={(e) => {
                      // Limit the document length
                      if (e.target.value.length <= MAX_DOCUMENT_LENGTH) {
                        setDocumentContent(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20 min-h-[300px]"
                    placeholder="Paste your document content here..."
                    required
                  />
                  <div className="mt-2 text-xs text-gray-400 flex justify-between">
                    <span>Characters: {documentContent.length}</span>
                    <span
                      className={
                        documentContent.length > MAX_DOCUMENT_LENGTH * 0.9
                          ? "text-red-400"
                          : ""
                      }
                    >
                      Maximum: {MAX_DOCUMENT_LENGTH}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isGenerating || !documentContent.trim()}
                    className="px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Extract Ideas
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <div
                  className="flex items-center justify-between mb-1 cursor-pointer"
                  onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                >
                  <h3 className="text-md font-medium">Document Summary</h3>
                  <button
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    aria-label={
                      isSummaryExpanded ? "Collapse summary" : "Expand summary"
                    }
                  >
                    {isSummaryExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isSummaryExpanded && (
                  <div className="p-3 bg-accent-1 border border-accent-2 rounded-md text-sm text-gray-300">
                    {documentSummary}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center mb-6">
                  <div className="flex border-b border-accent-2 w-full">
                    <button
                      onClick={() => setActiveTab("extracted")}
                      className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 ${
                        activeTab === "extracted"
                          ? "text-green-400 border-b-2 border-green-500"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Extracted Ideas ({extractedIdeas.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("suggested")}
                      className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 ${
                        activeTab === "suggested"
                          ? "text-purple-400 border-b-2 border-purple-500"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      <Brain className="w-4 h-4" />
                      AI Suggested Ideas ({suggestedIdeas.length})
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-medium">
                    {activeTab === "extracted"
                      ? "Ideas Extracted from Document"
                      : "AI-Suggested Complementary Ideas"}
                  </h3>
                  <div className="text-sm text-gray-400">
                    Select the ideas you want to create
                  </div>
                </div>

                {activeTab === "extracted" ? (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {extractedIdeas.length === 0 ? (
                      <div className="p-4 bg-accent-1 border border-accent-2 rounded-md text-gray-400 text-sm">
                        No ideas were found in the document. Try a different
                        document or check that your document actually describes
                        innovation ideas.
                      </div>
                    ) : (
                      extractedIdeas.map((idea, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-md transition-colors ${
                            idea.selected
                              ? "bg-green-500/10 border-green-900"
                              : "bg-accent-1 border-accent-2"
                          }`}
                        >
                          <div className="flex justify-between mb-2">
                            <h4 className="font-medium text-gray-200">
                              {idea.name}
                            </h4>
                            <button
                              onClick={() =>
                                toggleExtractedIdeaSelection(index)
                              }
                              className={`rounded-full p-1 transition-colors ${
                                idea.selected
                                  ? "bg-green-500 text-black hover:bg-green-400"
                                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {idea.selected ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-gray-300 mb-3">
                            {idea.summary}
                          </p>

                          {idea.source_text && (
                            <div className="mb-3 p-2 bg-accent-2/50 border-l-4 border-green-900 rounded-r-md">
                              <div className="flex items-start gap-2 text-xs text-gray-400">
                                <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <p className="italic">"{idea.source_text}"</p>
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                Location: {idea.location}
                              </div>
                            </div>
                          )}

                          <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">
                              Idea Attributes:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {idea.idea_attributes.map((attribute, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-accent-1 border border-accent-2 rounded-full text-xs text-gray-300"
                                >
                                  {attribute}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {idea.is_explicit
                                ? "Explicitly mentioned in document"
                                : "Implied by document content"}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {suggestedIdeas.length === 0 ? (
                      <div className="p-4 bg-accent-1 border border-accent-2 rounded-md text-gray-400 text-sm">
                        No additional ideas were suggested. Try a different
                        document or mission context.
                      </div>
                    ) : (
                      suggestedIdeas.map((idea, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-md transition-colors ${
                            idea.selected
                              ? "bg-purple-500/10 border-purple-900"
                              : "bg-accent-1 border-accent-2"
                          }`}
                        >
                          <div className="flex justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Brain className="w-4 h-4 text-purple-400" />
                              <h4 className="font-medium text-gray-200">
                                {idea.name}
                              </h4>
                            </div>
                            <button
                              onClick={() =>
                                toggleSuggestedIdeaSelection(index)
                              }
                              className={`rounded-full p-1 transition-colors ${
                                idea.selected
                                  ? "bg-purple-500 text-black hover:bg-purple-400"
                                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {idea.selected ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-gray-300 mb-3">
                            {idea.summary}
                          </p>

                          <div className="mb-3 p-2 bg-purple-500/10 border-l-4 border-purple-900 rounded-r-md">
                            <div className="text-xs text-gray-300">
                              <span className="text-purple-400 font-medium">
                                AI Rationale:{" "}
                              </span>
                              {idea.rationale}
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">
                              Idea Attributes:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {idea.idea_attributes.map((attribute, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-accent-1 border border-accent-2 rounded-full text-xs text-gray-300"
                                >
                                  {attribute}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-xs text-purple-400">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              AI-suggested idea (not directly from document)
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-800 mt-4">
                <button
                  onClick={() => {
                    // Reset all state to allow starting over
                    setExtractedIdeas([]);
                    setSuggestedIdeas([]);
                    setDocumentSummary("");
                    setDocumentContent("");
                    setError(null);
                  }}
                  className="px-4 py-2 bg-transparent border border-gray-700 text-gray-300 rounded-md hover:bg-gray-800"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSubmitSelectedIdeas}
                  disabled={
                    isSubmitting ||
                    !(
                      extractedIdeas.some((idea) => idea.selected) ||
                      suggestedIdeas.some((idea) => idea.selected)
                    )
                  }
                  className="px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Selected Ideas (
                      {extractedIdeas.filter((idea) => idea.selected).length +
                        suggestedIdeas.filter((idea) => idea.selected).length}
                      )
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
