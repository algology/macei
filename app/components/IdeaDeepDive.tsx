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
  Plus,
  X,
  AlertCircle,
  Trash2,
  Settings,
} from "lucide-react";
import { AIAnalysisResult, DeepAnalysisResult, IdeaAttribute } from "./types";
import { WithContext as ReactTags, Tag } from "react-tag-input";
import { IdeaKnowledgeBase } from "./IdeaKnowledgeBase";
import { MarketSignalsSection } from "./MarketSignalsSection";
import { KnowledgeBaseChat } from "./KnowledgeBaseChat";
import * as Tabs from "@radix-ui/react-tabs";
import { BriefingNotes } from "./BriefingNotes";
import { EmailToSignalConfig } from "./EmailToSignalConfig";
import { FeedbackWidget } from "./FeedbackWidget";
import { KnowledgeBaseChatIcon } from "./KnowledgeBaseChatIcon";
import { toast } from "sonner";

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
  auto_briefing_enabled?: boolean;
  conviction?: string;
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
  auto_briefing_enabled: true,
};

const getConvictionColor = (conviction?: string) => {
  switch (conviction) {
    case "Compelling":
      return "bg-green-500/20 text-green-400 border-green-900";
    case "Conditional":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-900";
    case "Postponed":
      return "bg-purple-500/20 text-purple-400 border-purple-900";
    case "Unfeasible":
      return "bg-red-500/20 text-red-400 border-red-900";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-900";
  }
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
  const [suggestingAttributes, setSuggestingAttributes] = useState(false);
  const [suggestedAttributes, setSuggestedAttributes] = useState<string[]>([]);
  const [attributeThinking, setAttributeThinking] = useState<string>("");
  const [insights, setInsights] = useState<any[]>([]);
  const [newInsight, setNewInsight] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [savingInsight, setSavingInsight] = useState(false);
  const [newSignalText, setNewSignalText] = useState("");
  const [isChatExpanded, setIsChatExpanded] = useState(false);

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

  useEffect(() => {
    if (ideaId) {
      fetchInsights();

      // Set up a real-time subscription to insights changes
      const insightsSubscription = supabase
        .channel(`idea-insights-${ideaId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "ideas",
            filter: `id=eq.${ideaId}`,
          },
          (payload) => {
            // When the idea is updated, check if insights have changed
            if (payload.new && payload.new.insights) {
              setInsights(payload.new.insights);
            }
          }
        )
        .subscribe();

      return () => {
        insightsSubscription.unsubscribe();
      };
    }
  }, [ideaId]);

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
      const [{ data: docs }, { data: knowledgeBase }] = await Promise.all([
        supabase.from("idea_documents").select("*").eq("idea_id", ideaId),
        supabase
          .from("knowledge_base")
          .select("*")
          .eq("idea_id", ideaId)
          .order("relevance_score", { ascending: false }),
      ]);

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

      // Create document context from actual knowledge base documents
      const documentsSection =
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

      // Create knowledge base section from actual market signals
      const knowledgeBaseSection =
        knowledgeBase && knowledgeBase.length > 0
          ? knowledgeBase
              .map(
                (signal) =>
                  `Market Signal: ${signal.title}\nSource: ${signal.source_name}\nDate: ${signal.publication_date}\nRelevance: ${signal.relevance_score}%\nContent: ${signal.content}\n---`
              )
              .join("\n\n")
          : "No market signals available";

      // Combine both sections
      const documentContext = `=== DOCUMENTS ===\n\n${documentsSection}\n\n=== MARKET SIGNALS ===\n\n${knowledgeBaseSection}`;

      // The 'data' variable already contains all fields due to select('*')
      // including 'conviction' if it exists on the fetched idea.
      const fetchedIdeaData = data as IdeaDetails; // Use the imported IdeaDetails type which now includes optional conviction

      setIdea(fetchedIdeaData);
      setEditedIdea(fetchedIdeaData);
      setMissionData(fetchedIdeaData.mission);
      setDocuments(documentContents);
      setDocumentContext(documentContext);

      // Parse signals/keywords
      if (fetchedIdeaData.signals) {
        try {
          let parsed;
          if (typeof fetchedIdeaData.signals === "string") {
            if (
              fetchedIdeaData.signals.trim().startsWith("[") ||
              fetchedIdeaData.signals.trim().startsWith("{")
            ) {
              parsed = JSON.parse(fetchedIdeaData.signals);
            } else {
              // Handle comma-separated string
              parsed = fetchedIdeaData.signals
                .split(",")
                .map((s: string) => s.trim());
            }
          } else {
            parsed = fetchedIdeaData.signals;
          }

          let keywordsList: string[] = [];

          if (Array.isArray(parsed)) {
            keywordsList = parsed;
          } else if (typeof parsed === "object" && parsed !== null) {
            // Handle object with categories
            keywordsList = Object.values(parsed).flat() as string[];
          }

          // Convert to CustomTag format
          const newKeywords: CustomTag[] = keywordsList.map(
            (keyword, index) => ({
              id: `${index}`,
              text: keyword,
              className:
                "bg-green-500/20 text-green-400 border border-green-900",
              category: "keyword",
            })
          );

          setKeywords(newKeywords);
        } catch (parseError) {
          console.error("Error parsing signals:", parseError);
          // Set empty keywords if parsing fails
          setKeywords([]);
        }
      } else {
        setKeywords([]);
      }
    } catch (error) {
      console.error("Error fetching idea:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editedIdea) return;

    setSaving(true);
    try {
      // Format signals from tags
      let formattedSignals = JSON.stringify(keywords.map((tag) => tag.text));

      const { error } = await supabase
        .from("ideas")
        .update({
          name: editedIdea.name,
          status: editedIdea.status,
          category: editedIdea.category,
          signals: formattedSignals,
          summary: editedIdea.summary,
          auto_briefing_enabled: editedIdea.auto_briefing_enabled,
          conviction: editedIdea.conviction,
        })
        .eq("id", ideaId);

      if (error) throw error;

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);

      // If there's a flag to refresh signals, keep it set for the next tab change
      const shouldRefreshSignals =
        localStorage.getItem("refreshSignalsOnTabChange") === "true";

      fetchIdea(); // Refresh the idea data

      // If user modifies signals and clicks save, make sure the market signals will refresh
      if (shouldRefreshSignals && activeTab !== "market-signals") {
        localStorage.setItem("refreshSignalsOnTabChange", "true");
      }
    } catch (error) {
      console.error("Error saving idea:", error);
      alert("Error saving idea. Please try again.");
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

  async function fetchInsights() {
    try {
      setLoadingInsights(true);
      const { data, error } = await supabase
        .from("ideas")
        .select("insights")
        .eq("id", ideaId)
        .single();

      if (error) throw error;
      setInsights(data?.insights || []);
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoadingInsights(false);
    }
  }

  async function addInsight() {
    if (!newInsight.trim()) return;

    try {
      setSavingInsight(true);
      const newInsightObj = {
        id: crypto.randomUUID(),
        content: newInsight.trim(),
        created_at: new Date().toISOString(),
        source: "manual",
      };

      const updatedInsights = [...insights, newInsightObj];

      const { error } = await supabase
        .from("ideas")
        .update({ insights: updatedInsights })
        .eq("id", ideaId);

      if (error) throw error;

      setNewInsight("");
      setInsights(updatedInsights);

      toast.success("Insight added", {
        description: "Your insight has been saved.",
        icon: <Lightbulb className="w-4 h-4" />,
      });
    } catch (error) {
      console.error("Error adding insight:", error);
      toast.error("Failed to add insight", {
        description: "Please try again.",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setSavingInsight(false);
    }
  }

  async function deleteInsight(insightId: string) {
    try {
      const updatedInsights = insights.filter(
        (insight) => insight.id !== insightId
      );

      const { error } = await supabase
        .from("ideas")
        .update({ insights: updatedInsights })
        .eq("id", ideaId);

      if (error) throw error;
      setInsights(updatedInsights);

      toast.success("Insight deleted", {
        description: "The insight has been removed.",
        icon: <Trash2 className="w-4 h-4" />,
      });
    } catch (error) {
      console.error("Error deleting insight:", error);
      toast.error("Failed to delete insight", {
        description: "Please try again.",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    }
  }

  async function addNewSignal() {
    if (!newSignalText.trim()) return;

    try {
      setSaving(true);
      // Create a new tag with the required CustomTag properties
      const newTag: CustomTag = {
        id: newSignalText.trim(),
        text: newSignalText.trim(),
        className: "tag-class",
        category: "keyword",
      };

      const newKeywords = [...keywords, newTag];
      setKeywords(newKeywords);
      setEditedIdea({
        ...editedIdea!,
        signals: JSON.stringify(newKeywords.map((k) => k.text)),
      });

      const { error } = await supabase
        .from("ideas")
        .update({
          signals: JSON.stringify(newKeywords.map((k) => k.text)),
        })
        .eq("id", ideaId);

      if (error) throw error;

      setNewSignalText("");
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);

      // If user modifies signals and clicks save, make sure the market signals will refresh
      localStorage.setItem("refreshSignalsOnTabChange", "true");

      // Refresh market signals if we're already on that tab
      if (activeTab === "market-signals") {
        setTimeout(() => {
          const refreshButton = document.querySelector(
            "[data-refresh-signals]"
          );
          if (refreshButton instanceof HTMLElement) {
            refreshButton.click();
          }
        }, 300);
      }
    } catch (error) {
      console.error("Error adding new signal:", error);
      toast.error("Failed to add new signal", {
        description: "Please try again.",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setSaving(false);
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
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                {editedIdea.name || "Idea Details"}
              </h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConvictionColor(
                  editedIdea.conviction
                )}`}
              >
                {editedIdea.conviction || "Undetermined"}
              </span>
            </div>
            <p className="text-gray-400">
              Analyze and validate your innovation ideas
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              value="market-signals"
              onClick={() => {
                // Check if we need to refresh signals based on attribute changes
                const shouldRefresh =
                  localStorage.getItem("refreshSignalsOnTabChange") === "true";
                if (shouldRefresh) {
                  localStorage.removeItem("refreshSignalsOnTabChange");
                  // Wait a moment for the tab to become active before refreshing
                  setTimeout(() => {
                    const refreshButton = document.querySelector(
                      "[data-refresh-signals]"
                    );
                    if (refreshButton instanceof HTMLElement) {
                      refreshButton.click();
                    }
                  }, 300);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                activeTab === "market-signals"
                  ? "text-white border-b-2 border-green-500"
                  : "text-gray-400"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Market Signals
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
            <Tabs.Trigger
              value="settings"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                activeTab === "settings"
                  ? "text-white border-b-2 border-green-500"
                  : "text-gray-400"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
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
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={editedIdea.status}
                        onChange={(e) =>
                          setEditedIdea({
                            ...editedIdea,
                            status: e.target.value as
                              | "validated"
                              | "in review"
                              | "ideation",
                          })
                        }
                        className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:ring-2 focus:ring-green-500/20 transition-all duration-200 appearance-none"
                      >
                        <option value="ideation">Ideation</option>
                        <option value="in review">In Review</option>
                        <option value="validated">Validated</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Conviction Level
                    </label>
                    <div className="relative">
                      <select
                        value={editedIdea.conviction || "Undetermined"}
                        onChange={(e) =>
                          setEditedIdea({
                            ...editedIdea,
                            conviction: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:ring-2 focus:ring-green-500/20 transition-all duration-200 appearance-none"
                      >
                        <option value="Undetermined">Undetermined</option>
                        <option value="Compelling">Compelling</option>
                        <option value="Conditional">Conditional</option>
                        <option value="Postponed">Postponed</option>
                        <option value="Unfeasible">Unfeasible</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
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

                <div className="bg-accent-1/50 border border-accent-2 rounded-xl p-6">
                  <IdeaKnowledgeBase
                    ideaId={parseInt(ideaId, 10)}
                    onDocumentAdded={() => {
                      fetchIdea();
                    }}
                  />
                </div>
              </div>

              <div className="space-y-6">
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

                <div className="bg-accent-1/50 border border-accent-2 rounded-xl p-4">
                  <EmailToSignalConfig
                    ideaId={parseInt(ideaId, 10)}
                    ideaName={editedIdea.name}
                  />
                </div>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="briefings" className="outline-none">
            <div className="space-y-6">
              <BriefingNotes
                ideaId={parseInt(ideaId, 10)}
                ideaName={editedIdea.name}
                onInsightAdded={fetchInsights}
                onSwitchToInsights={() => setActiveTab("insights")}
                onIdeaUpdated={fetchIdea}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="market-signals" className="outline-none">
            <div className="bg-gradient-to-br from-accent-1/60 to-accent-1/40 backdrop-blur-sm border border-accent-2 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-accent-1/10">
              <div className="mb-4">
                <h3 className="text-xl font-semibold mb-2">Market Signals</h3>
                <p className="text-gray-400 text-sm">
                  Track market trends and insights relevant to your idea.
                  Discover important news, trends, competitors, and industry
                  insights that could impact your innovation.
                </p>
              </div>

              <div className="bg-accent-1/50 border border-accent-2 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-400">
                    Current Idea Attributes
                  </label>
                </div>
                <div className="bg-accent-1 border border-accent-2 rounded-md p-3 mb-4">
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

                <p className="text-xs text-gray-500 mt-2">
                  Add signals or keywords to better track market data for your
                  idea
                </p>
              </div>

              <MarketSignalsSection
                ideaDetails={editedIdea}
                missionData={missionData}
                onInsightUpdate={() => {
                  // Refresh the knowledge base when a signal is saved
                  const knowledgeBase = document.querySelector(
                    '[data-component="knowledge-base"]'
                  );
                  if (knowledgeBase) {
                    (knowledgeBase as any).__fetchData?.();
                  }
                }}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="insights" className="outline-none">
            <div className="space-y-6">
              <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Insights</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-accent-1/30 border border-accent-2 rounded-lg p-4">
                      <textarea
                        value={newInsight}
                        onChange={(e) => setNewInsight(e.target.value)}
                        placeholder="Add a new insight..."
                        rows={3}
                        className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:ring-2 focus:ring-green-500/20 transition-all duration-200 resize-none mb-3"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={addInsight}
                          disabled={!newInsight.trim() || savingInsight}
                          className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {savingInsight ? (
                            <>
                              <LoadingSpinner className="w-4 h-4" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Add Insight
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {loadingInsights ? (
                      <div className="text-center py-8">
                        <LoadingSpinner className="w-6 h-6 mx-auto" />
                        <p className="text-gray-400 mt-2">
                          Loading insights...
                        </p>
                      </div>
                    ) : insights.length > 0 ? (
                      <div className="space-y-4">
                        {insights.map((insight) => (
                          <div
                            key={insight.id}
                            className="bg-accent-1/30 rounded-lg border border-accent-2 p-4 group"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <p className="text-gray-300 whitespace-pre-wrap flex-grow">
                                {insight.content}
                              </p>
                              <button
                                onClick={() => deleteInsight(insight.id)}
                                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete insight"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="mt-2 text-sm text-gray-500 flex items-center">
                              <span>
                                {new Date(
                                  insight.created_at
                                ).toLocaleDateString()}
                              </span>
                              {insight.source === "briefing" && (
                                <span className="insight-source-badge briefing flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  Briefing
                                </span>
                              )}
                              {insight.source === "manual" && (
                                <span className="insight-source-badge manual flex items-center gap-1">
                                  <Lightbulb className="w-3 h-3" />
                                  Manual
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No insights added yet. Add your first insight above.
                      </div>
                    )}
                  </div>
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
                      <details className="bg-accent-1/30 rounded-lg border border-accent-2 p-3 text-sm">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                          View Deep Analysis Input Data
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
                              Mission Context:
                            </div>
                            <div className="whitespace-pre-wrap">
                              <div>
                                <span className="text-gray-500">
                                  Organization:
                                </span>{" "}
                                {missionData?.organization?.name || (
                                  <em className="text-gray-600">
                                    Not provided
                                  </em>
                                )}
                              </div>
                              <div>
                                <span className="text-gray-500">Mission:</span>{" "}
                                {missionData?.name || (
                                  <em className="text-gray-600">
                                    Not provided
                                  </em>
                                )}
                              </div>
                              <div>
                                <span className="text-gray-500">
                                  Description:
                                </span>{" "}
                                {missionData?.description || (
                                  <em className="text-gray-600">
                                    Not provided
                                  </em>
                                )}
                              </div>
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
            <div className="space-y-6">
              <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm text-gray-400">
                    Idea Attributes
                  </label>
                  <button
                    onClick={async () => {
                      try {
                        setSuggestingAttributes(true);
                        setSuggestedAttributes([]);
                        setAttributeThinking("");

                        // Maximum number of retries for 500 errors
                        const MAX_RETRIES = 3;
                        let retryCount = 0;
                        let success = false;
                        let responseData;

                        while (!success && retryCount <= MAX_RETRIES) {
                          try {
                            const response = await fetch(
                              "/api/generate-idea-attributes",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  name: editedIdea.name,
                                  summary: editedIdea.summary,
                                  mission: missionData?.name,
                                  organization: missionData?.organization?.name,
                                }),
                              }
                            );

                            responseData = await response.json();

                            if (response.status === 500) {
                              // Only retry on 500 server errors
                              retryCount++;
                              if (retryCount <= MAX_RETRIES) {
                                console.log(
                                  `Retrying generate attributes (${retryCount}/${MAX_RETRIES})...`
                                );
                                // Exponential backoff: 1s, 2s, 4s
                                await new Promise((resolve) =>
                                  setTimeout(
                                    resolve,
                                    1000 * Math.pow(2, retryCount - 1)
                                  )
                                );
                                continue;
                              }
                            }

                            if (!response.ok) {
                              throw new Error(
                                responseData.error ||
                                  `HTTP error! status: ${response.status}`
                              );
                            }

                            // If we get here, the request was successful
                            success = true;
                          } catch (fetchError) {
                            // If it's the last retry or not a server error, rethrow
                            if (retryCount >= MAX_RETRIES) {
                              throw fetchError;
                            }
                            // Otherwise, continue to the next retry
                            retryCount++;
                            console.log(
                              `Fetch error, retrying (${retryCount}/${MAX_RETRIES})...`,
                              fetchError
                            );
                            // Exponential backoff: 1s, 2s, 4s
                            await new Promise((resolve) =>
                              setTimeout(
                                resolve,
                                1000 * Math.pow(2, retryCount - 1)
                              )
                            );
                          }
                        }

                        if (responseData.error)
                          throw new Error(responseData.error);

                        // Validate response format
                        if (
                          !responseData.content?.attributes ||
                          !Array.isArray(responseData.content.attributes)
                        ) {
                          throw new Error(
                            "Invalid response format from server"
                          );
                        }

                        setSuggestedAttributes(responseData.content.attributes);
                        setAttributeThinking(responseData.thinking || "");
                      } catch (error) {
                        console.error("Error suggesting attributes:", error);
                        alert(
                          "Failed to suggest attributes. Please try again."
                        );
                      } finally {
                        setSuggestingAttributes(false);
                      }
                    }}
                    disabled={suggestingAttributes || !editedIdea.summary}
                    className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-900 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {suggestingAttributes ? (
                      <>
                        <LoadingSpinner className="w-4 h-4 animate-spin" />
                        Suggesting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Suggest Attributes
                      </>
                    )}
                  </button>
                </div>

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
                  Press enter or comma to add an attribute. These attributes
                  will be used to track the idea.
                </p>

                {(suggestedAttributes.length > 0 || attributeThinking) && (
                  <div className="mt-6 space-y-4">
                    {attributeThinking && (
                      <div className="bg-accent-1/30 rounded-lg border border-accent-2 p-4">
                        <h4 className="text-sm font-medium mb-2 text-gray-400">
                          Analysis Process
                        </h4>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                          {attributeThinking}
                        </p>
                      </div>
                    )}

                    {suggestedAttributes.length > 0 && (
                      <div className="bg-accent-1/30 rounded-lg border border-accent-2 p-4">
                        <h4 className="text-sm font-medium mb-3 text-gray-400">
                          Suggested Attributes
                        </h4>
                        <div className="space-y-2">
                          {suggestedAttributes.map((attr, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                const newTag: CustomTag = {
                                  id: attr,
                                  text: attr,
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
                              className="w-full text-left px-3 py-2 bg-purple-500/10 text-purple-400 border border-purple-900 rounded hover:bg-purple-500/20 transition-colors flex items-center justify-between group"
                            >
                              <span>{attr}</span>
                              <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="settings" className="outline-none">
            <div className="space-y-6">
              <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Idea Settings</h3>

                <div className="space-y-4">
                  <div className="bg-accent-1/30 border border-accent-2 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Automated Briefings</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          Receive weekly automated briefing notes and
                          notifications
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editedIdea?.auto_briefing_enabled !== false}
                          onChange={(e) => {
                            if (editedIdea) {
                              setEditedIdea({
                                ...editedIdea,
                                auto_briefing_enabled: e.target.checked,
                              });
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Space for additional settings */}
                  {/* <div className="bg-accent-1/30 border border-accent-2 rounded-lg p-4">
                    Additional settings can be added here
                  </div> */}
                </div>
              </div>
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

      {/* Knowledge Base Chat Icon */}
      <KnowledgeBaseChatIcon
        ideaId={Number(ideaId)}
        ideaName={editedIdea?.name || ""}
        onToggle={() => setIsChatExpanded(!isChatExpanded)}
        isExpanded={isChatExpanded}
      />

      {/* Feedback Widget */}
      <FeedbackWidget ideaId={Number(ideaId)} variant="floating" />

      {/* Expanded Knowledge Base Chat */}
      {isChatExpanded && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] sm:w-[600px] md:w-[720px] lg:w-[800px] xl:w-[1000px] 2xl:w-[1200px] max-w-[1400px] bg-accent-1/95 backdrop-blur-md border border-accent-2 rounded-xl h-[500px] shadow-lg shadow-accent-1/20 z-50 transition-all duration-300 ease-in-out">
          <div
            className="px-4 h-10 cursor-pointer flex items-center justify-between transition-colors rounded-t-xl"
            onClick={() => setIsChatExpanded(false)}
          >
            <h3 className="text-base font-semibold leading-none">
              Knowledge Base Chat
            </h3>
            <ChevronDown className="w-4 h-4" />
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-hidden">
            <div className="p-4 h-full">
              <KnowledgeBaseChat
                ideaDetails={editedIdea}
                documents={documentContext}
                onFocus={() => setIsChatExpanded(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
