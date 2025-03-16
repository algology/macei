import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  Check,
  Brain,
  RefreshCw,
  ChevronDown,
  Target,
  TrendingUp,
  Users,
  LineChart,
  Lightbulb,
  Boxes,
  Gauge,
  Microscope,
  Home,
  FileText,
  Sparkles,
  ListTodo,
} from "lucide-react";
import { AIAnalysisResult, DeepAnalysisResult, IdeaAttribute } from "./types";
import { WithContext as ReactTags, Tag } from "react-tag-input";
import { IdeaKnowledgeBase } from "./IdeaKnowledgeBase";
import { NewsSection } from "./NewsSection";
import { KnowledgeBaseChat } from "./KnowledgeBaseChat";
import * as Tabs from "@radix-ui/react-tabs";

interface Props {
  ideaId: string;
}

interface IdeaDetails {
  id: number;
  name: string;
  status: "validated" | "in review" | "ideation";
  category: string;
  signals: string;
  created_at: string;
  ai_analysis?: string;
  last_analyzed?: string;
  mission_id: string;
  mission?: {
    id: number;
    name: string;
    organization?: {
      id: number;
      name: string;
    };
  };
  detailed_analysis?: string;
  summary?: string;
}

interface CustomTag {
  id: string;
  text: string;
  className: string;
  category: string;
  [key: string]: string;
}

const defaultIdea: IdeaDetails = {
  id: 0,
  name: "",
  status: "ideation",
  category: "",
  signals: "",
  created_at: "",
  ai_analysis: "",
  last_analyzed: "",
  mission_id: "",
};

export function IdeaDeepDive({ ideaId }: Props) {
  const [idea, setIdea] = useState<IdeaDetails | null>(null);
  const [editedIdea, setEditedIdea] = useState<IdeaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [missionData, setMissionData] = useState<any | null>(null);
  const [keywords, setKeywords] = useState<CustomTag[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisResult | null>(
    null
  );
  const [documentContext, setDocumentContext] = useState<string>("");
  const [activeTab, setActiveTab] = useState("home");

  const KeyCodes = {
    comma: 188,
    enter: 13,
  };

  const delimiters = [KeyCodes.comma, KeyCodes.enter];

  useEffect(() => {
    fetchIdea();
  }, [ideaId]);

  useEffect(() => {
    if (editedIdea?.signals) {
      try {
        const parsedKeywords = JSON.parse(editedIdea.signals);
        if (typeof parsedKeywords === "string") {
          // Handle single string
          setKeywords([
            {
              id: parsedKeywords,
              text: parsedKeywords,
              className: "tag-class",
              category: selectedCategory,
            },
          ]);
        } else if (Array.isArray(parsedKeywords)) {
          // Handle array of strings
          setKeywords(
            parsedKeywords.map((keyword) => ({
              id: keyword,
              text: keyword,
              className: "tag-class",
              category: selectedCategory,
            }))
          );
        } else {
          // Handle object with categories
          const allKeywords = Object.entries(parsedKeywords).flatMap(
            ([category, words]) =>
              (words as string[]).map((word) => ({
                id: word,
                text: word,
                className: "tag-class",
                category: category,
              }))
          );
          setKeywords(allKeywords);
        }
      } catch (e) {
        // Handle plain text format
        if (editedIdea.signals) {
          const words = editedIdea.signals
            .split(",")
            .map((word) => word.trim())
            .filter(Boolean);
          setKeywords(
            words.map((word) => ({
              id: word,
              text: word,
              className: "tag-class",
              category: selectedCategory,
            }))
          );
        }
      }
    }
  }, [editedIdea?.signals, selectedCategory]);

  async function fetchIdea() {
    try {
      const { data, error } = await supabase
        .from("ideas")
        .select(
          `
          *,
          mission:missions (
            *,
            organization:organizations (*)
          )
        `
        )
        .eq("id", ideaId)
        .single();

      if (error) throw error;

      // Fetch documents for this idea
      const { data: docs } = await supabase
        .from("idea_documents")
        .select("*")
        .eq("idea_id", ideaId);

      // Download and parse document contents
      const documentContents = await Promise.all(
        (docs || []).map(
          async (doc: { id: number; name: string; url: string }) => {
            const content = await downloadAndParseDocument(doc.url);
            return {
              ...doc,
              content: content || "Failed to load document content",
            };
          }
        )
      );

      // Prepare document context string
      const documentContext =
        documentContents.length > 0
          ? documentContents
              .map(
                (doc) =>
                  `Document: ${doc.name}\nType: ${doc.url
                    .split(".")
                    .pop()}\nContent:\n${doc.content}\n---`
              )
              .join("\n\n")
          : "No documents available";

      setIdea(data);
      setEditedIdea(data);
      setMissionData(data.mission);
      setDocuments(documentContents);
      setDocumentContext(documentContext);
    } catch (error) {
      console.error("Error fetching idea:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!idea || !editedIdea) return;

    try {
      setSaving(true);
      const ideaToUpdate = {
        name: editedIdea.name,
        status: editedIdea.status,
        category: editedIdea.category,
        signals: JSON.stringify(keywords.map((k) => k.text)),
        mission_id: editedIdea.mission_id,
      };

      const { error } = await supabase
        .from("ideas")
        .update(ideaToUpdate)
        .eq("id", idea.id);

      if (error) throw error;

      setIdea({ ...editedIdea, ...ideaToUpdate });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error("Error updating idea:", error);
      alert("Failed to update idea. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadAndParseDocument(url: string) {
    try {
      // Extract the file path from the URL
      const filePath = url.split("idea-documents/")[1];

      // Download the file using Supabase storage
      const { data, error } = await supabase.storage
        .from("idea-documents")
        .download(filePath);

      if (error) throw error;

      // Convert the blob to text
      const text = await data.text();
      return text;
    } catch (error) {
      console.error("Error downloading document:", error);
      return null;
    }
  }

  async function triggerAIAnalysis() {
    if (!editedIdea) return;

    try {
      setAnalyzing(true);

      // First fetch the mission and organization data
      const { data: missionData } = await supabase
        .from("missions")
        .select(
          `
          *,
          organization:organizations(*)
        `
        )
        .eq("id", editedIdea.mission_id)
        .single();

      // Fetch documents for this idea
      const { data: documents } = await supabase
        .from("idea_documents")
        .select("*")
        .eq("idea_id", editedIdea.id);

      setDocuments(documents || []);

      // Download and parse document contents
      const documentContents = await Promise.all(
        (documents || []).map(async (doc) => {
          const content = await downloadAndParseDocument(doc.url);
          return {
            name: doc.name,
            type: doc.url.split(".").pop(),
            content: content || "Failed to load document content",
          };
        })
      );

      // Prepare document context string with actual content
      const documentContext =
        documentContents.length > 0
          ? documentContents
              .map(
                (doc) =>
                  `Document: ${doc.name}\nType: ${doc.type}\nContent:\n${doc.content}\n---`
              )
              .join("\n\n")
          : "No documents available";

      const response = await fetch("/api/analyze-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedIdea.name,
          category: editedIdea.category,
          signals: editedIdea.signals,
          status: editedIdea.status,
          organization: missionData?.organization?.name,
          mission: missionData?.name,
          mission_description: missionData?.description,
          documents: documentContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Extract JSON from the markdown response if needed
      let analysisJson = data.content;
      if (data.content.includes("```json")) {
        const jsonMatch = data.content.match(/```json\n([\s\S]*?)\n```/);
        analysisJson = jsonMatch ? jsonMatch[1] : data.content;
      }

      // Parse the JSON to validate it
      const parsedAnalysis = JSON.parse(analysisJson);

      const updatedIdea = {
        ...editedIdea,
        ai_analysis: JSON.stringify(parsedAnalysis),
        last_analyzed: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("ideas")
        .update({
          ai_analysis: updatedIdea.ai_analysis,
          last_analyzed: updatedIdea.last_analyzed,
        })
        .eq("id", editedIdea.id);

      if (updateError) throw updateError;

      setEditedIdea(updatedIdea);
      setIdea(updatedIdea);
      setMissionData(missionData);
      setDocuments(documents || []);
    } catch (error) {
      console.error("Error analyzing idea:", error);
      alert("Failed to analyze idea. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function triggerDeepAnalysis() {
    if (!editedIdea) return;

    try {
      setDeepAnalyzing(true);

      // Download and parse document contents
      const documentContents = await Promise.all(
        (documents || []).map(async (doc) => {
          const content = await downloadAndParseDocument(doc.url);
          return {
            name: doc.name,
            type: doc.url.split(".").pop(),
            content: content || "Failed to load document content",
          };
        })
      );

      // Prepare document context string
      const documentContext =
        documentContents.length > 0
          ? documentContents
              .map(
                (doc) =>
                  `Document: ${doc.name}\nType: ${doc.type}\nContent:\n${doc.content}\n---`
              )
              .join("\n\n")
          : "No documents available";

      const response = await fetch("/api/deep-analyze-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editedIdea.id,
          name: editedIdea.name,
          category: editedIdea.category,
          signals: editedIdea.signals,
          status: editedIdea.status,
          organization: missionData?.organization?.name,
          mission: missionData?.name,
          mission_description: missionData?.description,
          documents: documentContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const parsedAnalysis = data.content;
      setDeepAnalysis(parsedAnalysis);

      const updatedIdea = {
        ...editedIdea,
        detailed_analysis: JSON.stringify(parsedAnalysis),
      };

      const { error: updateError } = await supabase
        .from("ideas")
        .update({
          detailed_analysis: updatedIdea.detailed_analysis,
        })
        .eq("id", editedIdea.id);

      if (updateError) throw updateError;

      setEditedIdea(updatedIdea);
    } catch (error) {
      console.error("Error in deep analysis:", error);
      alert("Failed to perform deep analysis. Please try again.");
    } finally {
      setDeepAnalyzing(false);
    }
  }

  const hasChanges = JSON.stringify(idea) !== JSON.stringify(editedIdea);

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-accent-1/10 to-background p-6">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div className="h-8 bg-accent-1/30 rounded-lg w-1/4"></div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="h-64 bg-accent-1/30 rounded-xl"></div>
              <div className="h-40 bg-accent-1/30 rounded-xl"></div>
            </div>
            <div className="space-y-6">
              <div className="h-96 bg-accent-1/30 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  if (!idea || !editedIdea) return <div>Idea not found</div>;

  return (
    <div className="space-y-8 min-h-screen bg-gradient-to-b from-background via-accent-1/10 to-background p-6">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Idea Deep Dive
            </h2>
            <p className="text-gray-400 mt-2">
              Analyze and validate your innovation ideas
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
              hasChanges
                ? "bg-green-500/20 text-green-400 border border-green-900 hover:bg-green-500/30"
                : "bg-gray-500/20 text-gray-400 border border-gray-800 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <LoadingSpinner className="w-4 h-4" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="flex space-x-1 border-b border-accent-2 mb-6">
            <Tabs.Trigger
              value="home"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                activeTab === "home"
                  ? "text-white border-b-2 border-green-500"
                  : "text-gray-400"
              }`}
            >
              <Home className="w-4 h-4" />
              Idea Home
            </Tabs.Trigger>
            <Tabs.Trigger
              value="briefings"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                activeTab === "briefings"
                  ? "text-white border-b-2 border-green-500"
                  : "text-gray-400"
              }`}
            >
              <FileText className="w-4 h-4" />
              Briefings
            </Tabs.Trigger>
            <Tabs.Trigger
              value="insights"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                activeTab === "insights"
                  ? "text-white border-b-2 border-green-500"
                  : "text-gray-400"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Insights
            </Tabs.Trigger>
            <Tabs.Trigger
              value="attributes"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                activeTab === "attributes"
                  ? "text-white border-b-2 border-green-500"
                  : "text-gray-400"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Attributes
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="home" className="outline-none">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6 space-y-4 transition-all duration-200 hover:bg-accent-1/60 hover:shadow-lg hover:shadow-accent-1/20">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editedIdea.name}
                      onChange={(e) =>
                        setEditedIdea({ ...editedIdea, name: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Summary
                    </label>
                    <textarea
                      value={editedIdea.summary || ""}
                      onChange={(e) =>
                        setEditedIdea({
                          ...editedIdea,
                          summary: e.target.value,
                        })
                      }
                      rows={4}
                      className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:ring-2 focus:ring-green-500/20 transition-all duration-200 resize-none"
                      placeholder="Describe your idea..."
                    />
                  </div>
                </div>

                <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                  <label className="block text-sm text-gray-400 mb-1">
                    Idea Attributes
                  </label>
                  <div className="bg-accent-1 border border-accent-2 rounded-md p-2">
                    <ReactTags
                      tags={keywords}
                      delimiters={delimiters}
                      handleDelete={(i) => {
                        try {
                          const newKeywords = keywords.filter(
                            (_, index) => index !== i
                          );
                          setKeywords(newKeywords);
                          setEditedIdea({
                            ...editedIdea!,
                            signals: JSON.stringify(
                              newKeywords.map((k) => k.text)
                            ),
                          });
                        } catch (error) {
                          console.error("Error deleting keyword:", error);
                        }
                      }}
                      handleAddition={(tag: Tag) => {
                        const newTag: CustomTag = {
                          id: tag.id,
                          text: tag.id,
                          className: "tag-class",
                          category: selectedCategory,
                        };
                        const newKeywords = [...keywords, newTag];
                        setKeywords(newKeywords);
                        setEditedIdea({
                          ...editedIdea!,
                          signals: JSON.stringify(
                            newKeywords.map((k) => k.text)
                          ),
                        });
                      }}
                      inputFieldPosition="bottom"
                      placeholder="Type an attribute and press enter..."
                      autofocus={false}
                      allowUnique={true}
                      classNames={{
                        tags: "space-y-2",
                        tagInput: "mt-2 pt-2 border-t border-accent-2",
                        tag: "inline-flex items-center bg-green-500/20 text-green-400 border border-green-900 px-2 py-1 rounded-md mr-2",
                        remove:
                          "ml-2 text-green-400 hover:text-green-300 cursor-pointer",
                        suggestions: "hidden",
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Press enter or comma to add an attribute. These attributes
                    will be used to track the idea.
                  </p>
                </div>

                <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                  <NewsSection
                    ideaDetails={editedIdea}
                    missionData={missionData}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-accent-1/50 border border-accent-2 rounded-xl p-6">
                  <IdeaKnowledgeBase
                    ideaId={parseInt(ideaId, 10)}
                    onDocumentAdded={() => {
                      fetchIdea();
                    }}
                  />
                </div>

                <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Knowledge Base Chat
                    </h3>
                  </div>
                  <KnowledgeBaseChat
                    ideaDetails={editedIdea}
                    documents={documentContext}
                  />
                </div>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="briefings" className="outline-none">
            <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
              <NewsSection ideaDetails={editedIdea} missionData={missionData} />
            </div>
          </Tabs.Content>

          <Tabs.Content value="insights" className="outline-none">
            <div className="space-y-6">
              <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">AI Analysis</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={triggerDeepAnalysis}
                        disabled={deepAnalyzing}
                        className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-900 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {deepAnalyzing ? (
                          <>
                            <LoadingSpinner className="w-4 h-4 animate-spin" />
                            Deep Research...
                          </>
                        ) : (
                          <>
                            <Microscope className="w-4 h-4" />
                            Deep Research
                          </>
                        )}
                      </button>
                      <button
                        onClick={triggerAIAnalysis}
                        disabled={analyzing}
                        className="px-4 py-2 bg-accent-1/50 border border-accent-2 rounded-lg hover:bg-accent-1/80 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {analyzing ? (
                          <>
                            <LoadingSpinner className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4" />
                            Analyze
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {editedIdea.ai_analysis ? (
                    <div className="space-y-6">
                      <details className="bg-accent-1/30 rounded-lg border border-accent-2 p-3 text-sm">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                          View Analysis Input Data
                        </summary>
                        <div className="mt-2 space-y-2 text-gray-400">
                          <div>
                            <span className="text-gray-500">Name:</span>{" "}
                            {editedIdea.name || (
                              <em className="text-gray-600">Not provided</em>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500">Category:</span>{" "}
                            {editedIdea.category || (
                              <em className="text-gray-600">Not provided</em>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>{" "}
                            {editedIdea.status || (
                              <em className="text-gray-600">Not provided</em>
                            )}
                          </div>
                          <div className="border-t border-accent-2 pt-2 mt-2">
                            <div className="text-gray-500 mb-1">
                              Market Signals:
                            </div>
                            <div className="whitespace-pre-wrap">
                              {editedIdea.signals || (
                                <em className="text-gray-600">Not provided</em>
                              )}
                            </div>
                          </div>
                          <div className="border-t border-accent-2 pt-2 mt-2">
                            <div className="text-gray-500 mb-1">
                              Knowledge Base Documents:
                            </div>
                            <div className="whitespace-pre-wrap">
                              {documents?.length > 0 ? (
                                documents.map((doc) => (
                                  <div key={doc.id}>
                                    • {doc.name} ({doc.url.split(".").pop()})
                                  </div>
                                ))
                              ) : (
                                <em className="text-gray-600">
                                  No documents available
                                </em>
                              )}
                            </div>
                          </div>
                        </div>
                      </details>

                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(
                          JSON.parse(editedIdea.ai_analysis) as AIAnalysisResult
                        ).map(([key, value]) => {
                          // Helper function to get the appropriate icon
                          const getIcon = (key: string) => {
                            switch (key) {
                              case "marketPotential":
                                return (
                                  <TrendingUp className="w-4 h-4 text-gray-400" />
                                );
                              case "customerFit":
                                return (
                                  <Users className="w-4 h-4 text-gray-400" />
                                );
                              case "feasibility":
                                return (
                                  <Boxes className="w-4 h-4 text-gray-400" />
                                );
                              case "innovation":
                                return (
                                  <Lightbulb className="w-4 h-4 text-gray-400" />
                                );
                              case "scalability":
                                return (
                                  <LineChart className="w-4 h-4 text-gray-400" />
                                );
                              case "missionAlignment":
                                return (
                                  <Target className="w-4 h-4 text-gray-400" />
                                );
                              default:
                                return (
                                  <Brain className="w-4 h-4 text-gray-400" />
                                );
                            }
                          };

                          return (
                            <div
                              key={key}
                              className="bg-accent-1/30 rounded-lg border border-accent-2 p-4"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getIcon(key)}
                                  <h4 className="text-sm font-medium capitalize">
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-16 h-2 rounded-full bg-gradient-to-r"
                                    style={{
                                      backgroundImage: `linear-gradient(to right, 
                                        ${
                                          value.score >= 33 ? "#22c55e" : "#666"
                                        } 33%, 
                                        ${
                                          value.score >= 66 ? "#22c55e" : "#666"
                                        } 66%, 
                                        ${
                                          value.score >= 100
                                            ? "#22c55e"
                                            : "#666"
                                        } 100%)`,
                                    }}
                                  />
                                  <span className="text-sm text-gray-400">
                                    {value.score}%
                                  </span>
                                </div>
                              </div>
                              <div className="bg-accent-1/50 rounded p-3 text-sm text-gray-300">
                                {value.analysis}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {editedIdea.last_analyzed && (
                        <div className="text-sm text-gray-400">
                          Last analyzed:{" "}
                          {new Date(
                            editedIdea.last_analyzed
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center py-12">
                      Click analyze to get AI insights about this idea based on
                      the provided information and market signals.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Deep Research Analysis
                    </h3>
                    <button
                      onClick={triggerDeepAnalysis}
                      disabled={deepAnalyzing}
                      className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-900 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {deepAnalyzing ? (
                        <>
                          <LoadingSpinner className="w-4 h-4 animate-spin" />
                          Deep Research...
                        </>
                      ) : (
                        <>
                          <Microscope className="w-4 h-4" />
                          Deep Research
                        </>
                      )}
                    </button>
                  </div>

                  {editedIdea.detailed_analysis ? (
                    <div className="space-y-6">
                      <div className="bg-accent-1/30 rounded-lg border border-accent-2 p-4">
                        <h4 className="text-sm font-medium mb-2">
                          Executive Summary
                        </h4>
                        <p className="text-sm text-gray-300">
                          {JSON.parse(editedIdea.detailed_analysis).summary}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {JSON.parse(
                          editedIdea.detailed_analysis
                        ).attributes.map((attr: IdeaAttribute) => (
                          <div
                            key={attr.name}
                            className="bg-accent-1/30 rounded-lg border border-accent-2 p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium">
                                {attr.name}
                              </h4>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-16 h-2 rounded-full bg-gradient-to-r"
                                  style={{
                                    backgroundImage: `linear-gradient(to right, 
                                    ${
                                      attr.importance >= 33 ? "#22c55e" : "#666"
                                    } 33%, 
                                    ${
                                      attr.importance >= 66 ? "#22c55e" : "#666"
                                    } 66%, 
                                    ${
                                      attr.importance >= 100
                                        ? "#22c55e"
                                        : "#666"
                                    } 100%)`,
                                  }}
                                />
                                <span className="text-sm text-gray-400">
                                  {attr.importance}%
                                </span>
                              </div>
                            </div>

                            <div className="space-y-3 text-sm">
                              <div>
                                <div className="text-gray-400 mb-1">
                                  Current Assessment
                                </div>
                                <div className="bg-accent-1/50 rounded p-2 text-gray-300">
                                  {attr.current_assessment}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-gray-400 mb-1">
                                    Risks
                                  </div>
                                  <div className="bg-red-500/10 text-red-400 border border-red-900 rounded p-2">
                                    {attr.risks}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-400 mb-1">
                                    Opportunities
                                  </div>
                                  <div className="bg-green-500/10 text-green-400 border border-green-900 rounded p-2">
                                    {attr.opportunities}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="text-gray-400 mb-1">
                                  Supporting Evidence
                                </div>
                                <div className="bg-accent-1/50 rounded p-2 text-gray-300">
                                  {attr.evidence}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center py-12">
                      Click Deep Research to get an in-depth analysis of the key
                      attributes that will determine this idea's success.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="attributes" className="outline-none">
            <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
              <label className="block text-sm text-gray-400 mb-1">
                Idea Attributes
              </label>
              <div className="bg-accent-1 border border-accent-2 rounded-md p-2">
                <ReactTags
                  tags={keywords}
                  delimiters={delimiters}
                  handleDelete={(i) => {
                    try {
                      const newKeywords = keywords.filter(
                        (_, index) => index !== i
                      );
                      setKeywords(newKeywords);
                      setEditedIdea({
                        ...editedIdea!,
                        signals: JSON.stringify(newKeywords.map((k) => k.text)),
                      });
                    } catch (error) {
                      console.error("Error deleting keyword:", error);
                    }
                  }}
                  handleAddition={(tag: Tag) => {
                    const newTag: CustomTag = {
                      id: tag.id,
                      text: tag.id,
                      className: "tag-class",
                      category: selectedCategory,
                    };
                    const newKeywords = [...keywords, newTag];
                    setKeywords(newKeywords);
                    setEditedIdea({
                      ...editedIdea!,
                      signals: JSON.stringify(newKeywords.map((k) => k.text)),
                    });
                  }}
                  inputFieldPosition="bottom"
                  placeholder="Type an attribute and press enter..."
                  autofocus={false}
                  allowUnique={true}
                  classNames={{
                    tags: "space-y-2",
                    tagInput: "mt-2 pt-2 border-t border-accent-2",
                    tag: "inline-flex items-center bg-green-500/20 text-green-400 border border-green-900 px-2 py-1 rounded-md mr-2",
                    remove:
                      "ml-2 text-green-400 hover:text-green-300 cursor-pointer",
                    suggestions: "hidden",
                  }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Press enter or comma to add an attribute. These attributes will
                be used to track the idea.
              </p>
            </div>
          </Tabs.Content>
        </Tabs.Root>

        {showSaved && (
          <div className="fixed bottom-4 right-4 bg-green-900 text-green-400 px-4 py-2 rounded-md border border-green-900 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Changes saved
          </div>
        )}
      </div>
    </div>
  );
}
