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
} from "lucide-react";
import { AIAnalysisResult } from "./types";
import { WithContext as ReactTags, Tag } from "react-tag-input";

interface Props {
  ideaId: string;
}

interface IdeaDetails {
  id: number;
  name: string;
  status: "validated" | "in review" | "ideation";
  category: string;
  impact: "High" | "Medium" | "Low";
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
}

interface CustomTag {
  id: string;
  text: string;
  className: string;
  [key: string]: string;
}

const defaultIdea: IdeaDetails = {
  id: 0,
  name: "",
  status: "ideation",
  category: "",
  impact: "Medium",
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
        setKeywords(
          parsedKeywords.map((keyword: string) => ({
            id: keyword,
            text: keyword,
            className: "tag-class",
          }))
        );
      } catch (e) {
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
            }))
          );
        }
      }
    }
  }, [editedIdea?.signals]);

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
      setIdea(data);
      setEditedIdea(data);
      setMissionData(data.mission);
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
        impact: editedIdea.impact,
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

      const response = await fetch("/api/analyze-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedIdea.name,
          category: editedIdea.category,
          signals: editedIdea.signals,
          status: editedIdea.status,
          impact: editedIdea.impact,
          organization: missionData?.organization?.name,
          mission: missionData?.name,
          mission_description: missionData?.description,
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
    } catch (error) {
      console.error("Error analyzing idea:", error);
      alert("Failed to analyze idea. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const hasChanges = JSON.stringify(idea) !== JSON.stringify(editedIdea);

  if (loading) return <LoadingSpinner />;
  if (!idea || !editedIdea) return <div>Idea not found</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Idea Details</h2>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-4 py-2 rounded-md text-sm flex items-center gap-2 ${
            hasChanges
              ? "bg-green-500/20 text-green-400 border border-green-900 hover:bg-green-500/30"
              : "bg-gray-500/20 text-gray-400 border border-gray-800 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={editedIdea.name}
                onChange={(e) =>
                  setEditedIdea({ ...editedIdea, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <div className="relative">
                <select
                  value={editedIdea.status}
                  onChange={(e) =>
                    setEditedIdea({
                      ...editedIdea,
                      status: e.target.value as IdeaDetails["status"],
                    })
                  }
                  className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md appearance-none"
                >
                  <option value="ideation">Ideation</option>
                  <option value="in review">In Review</option>
                  <option value="validated">Validated</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Category
              </label>
              <input
                type="text"
                value={editedIdea.category || ""}
                onChange={(e) =>
                  setEditedIdea({ ...editedIdea, category: e.target.value })
                }
                className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Impact</label>
              <div className="relative">
                <select
                  value={editedIdea.impact || "Medium"}
                  onChange={(e) =>
                    setEditedIdea({
                      ...editedIdea,
                      impact: e.target.value as IdeaDetails["impact"],
                    })
                  }
                  className="w-full px-3 py-2 bg-accent-1 border border-accent-2 rounded-md appearance-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
            <label className="block text-sm text-gray-400 mb-1">
              Market Signal Keywords
            </label>
            <div className="bg-accent-1 border border-accent-2 rounded-md p-2">
              <ReactTags
                tags={keywords}
                delimiters={delimiters}
                handleDelete={(i) => {
                  const newKeywords = keywords.filter(
                    (_, index) => index !== i
                  );
                  setKeywords(newKeywords);
                  setEditedIdea({
                    ...editedIdea!,
                    signals: JSON.stringify(newKeywords.map((k) => k.text)),
                  });
                }}
                handleAddition={(tag: Tag) => {
                  const newTag: CustomTag = {
                    id: tag.id,
                    text: tag.id,
                    className: "tag-class",
                  };
                  const newKeywords = [...keywords, newTag];
                  setKeywords(newKeywords);
                  setEditedIdea({
                    ...editedIdea!,
                    signals: JSON.stringify(newKeywords.map((k) => k.text)),
                  });
                }}
                inputFieldPosition="bottom"
                placeholder="Type a keyword and press enter..."
                classNames={{
                  tags: "space-y-2",
                  tagInput: "mt-2",
                  tag: "inline-flex items-center bg-green-500/20 text-green-400 border border-green-900 px-2 py-1 rounded-md mr-2",
                  remove:
                    "ml-2 text-green-400 hover:text-green-300 cursor-pointer",
                  suggestions: "hidden",
                }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Press enter or comma to add a keyword. These keywords will be used
              to track market signals.
            </p>
          </div>
        </div>

        <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold">AI Analysis</h3>
            </div>
            <button
              onClick={triggerAIAnalysis}
              disabled={analyzing}
              className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-md text-sm flex items-center gap-2 hover:bg-green-500/30"
            >
              <RefreshCw
                className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`}
              />
              {analyzing ? "Analyzing..." : "Analyze"}
            </button>
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
                  <div>
                    <span className="text-gray-500">Impact:</span>{" "}
                    {editedIdea.impact || (
                      <em className="text-gray-600">Not provided</em>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Organization:</span>{" "}
                    {missionData?.organization?.name || (
                      <em className="text-gray-600">Not provided</em>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Mission:</span>{" "}
                    {missionData?.name || (
                      <em className="text-gray-600">Not provided</em>
                    )}
                  </div>
                  <div className="border-t border-accent-2 pt-2 mt-2">
                    <div className="text-gray-500 mb-1">Market Signals:</div>
                    <div className="whitespace-pre-wrap">
                      {editedIdea.signals || (
                        <em className="text-gray-600">Not provided</em>
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
                        return <TrendingUp className="w-4 h-4 text-gray-400" />;
                      case "customerFit":
                        return <Users className="w-4 h-4 text-gray-400" />;
                      case "feasibility":
                        return <Boxes className="w-4 h-4 text-gray-400" />;
                      case "innovation":
                        return <Lightbulb className="w-4 h-4 text-gray-400" />;
                      case "scalability":
                        return <LineChart className="w-4 h-4 text-gray-400" />;
                      case "missionAlignment":
                        return <Target className="w-4 h-4 text-gray-400" />;
                      case "impact":
                        return <Gauge className="w-4 h-4 text-gray-400" />;
                      default:
                        return <Brain className="w-4 h-4 text-gray-400" />;
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
                                    value.score >= 100 ? "#22c55e" : "#666"
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
                  {new Date(editedIdea.last_analyzed).toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-center py-12">
              Click analyze to get AI insights about this idea based on the
              provided information and market signals.
            </div>
          )}
        </div>
      </div>

      {showSaved && (
        <div className="fixed bottom-4 right-4 bg-green-900 text-green-400 px-4 py-2 rounded-md border border-green-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Changes saved
        </div>
      )}
    </div>
  );
}
