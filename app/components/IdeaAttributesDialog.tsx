import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Trash2, ChevronDown, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Idea } from "./types";
import { LoadingSpinner } from "./LoadingSpinner";

interface Props {
  idea: Idea;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function IdeaAttributesDialog({
  idea,
  isOpen,
  onOpenChange,
  onComplete,
}: Props) {
  const [attributes, setAttributes] = useState<string[]>([]);
  const [newAttribute, setNewAttribute] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string>("");
  const [showAttributes, setShowAttributes] = useState(false);
  const [fullThinking, setFullThinking] = useState<string>("");
  const [isThinkingComplete, setIsThinkingComplete] = useState(false);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState(true);
  const [showProcessing, setShowProcessing] = useState(false);
  const [thinkingPhases] = useState<string[]>([
    "Creating Idea",
    "Creating Attributes",
    "Setting up Knowledge Base",
  ]);
  const [readingItems] = useState<{ name: string; domain: string }[]>([
    { name: "Idea Summary", domain: "idea.com" },
    { name: "Mission", domain: "mission.io" },
    { name: "Organization", domain: "organization.co" },
  ]);

  useEffect(() => {
    // Auto-scroll the thinking div to the bottom when new content is added
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [thinking]);

  useEffect(() => {
    if (isOpen) {
      setThinking("");
      setFullThinking("");
      setShowAttributes(false);
      setAttributes([]);
      setIsThinkingComplete(false);
      setShowProcessing(false);

      // Show processing section after a delay
      setTimeout(() => {
        setShowProcessing(true);
      }, 800); // 800ms delay

      generateAttributes();
    }
  }, [isOpen]);

  // Simulate streaming effect for thinking
  useEffect(() => {
    if (fullThinking && !isThinkingComplete) {
      let currentIndex = thinking.length;

      // Add characters much more quickly (every 5ms)
      const interval = setInterval(() => {
        if (currentIndex < fullThinking.length) {
          // Add multiple characters at once for faster appearance
          const charsToAdd = 5; // Add 5 characters at a time
          setThinking(fullThinking.slice(0, currentIndex + charsToAdd));
          currentIndex += charsToAdd;
        } else {
          clearInterval(interval);
          setIsThinkingComplete(true);
          // Reduced wait time before showing attributes
          setTimeout(() => {
            setShowAttributes(true);
          }, 500);
        }
      }, 5); // Much faster interval

      return () => clearInterval(interval);
    }
  }, [fullThinking, isThinkingComplete]);

  async function generateAttributes() {
    try {
      setLoading(true);
      setError(null);
      setThinking("");
      setShowAttributes(false);
      setIsThinkingComplete(false);

      // Get mission data
      const { data: missionData, error: missionError } = await supabase
        .from("missions")
        .select("*, organization:organizations(*)")
        .eq("id", idea.mission_id)
        .single();

      if (missionError) {
        throw new Error(
          `Failed to fetch mission data: ${missionError.message}`
        );
      }

      // Maximum number of retries for 500 errors
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let success = false;
      let responseData;

      while (!success && retryCount <= MAX_RETRIES) {
        try {
          const response = await fetch("/api/generate-idea-attributes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: idea.name,
              summary: idea.summary,
              mission: missionData?.name,
              organization: missionData?.organization?.name,
            }),
          });

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
                setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1))
              );
              continue;
            }
          }

          if (!response.ok) {
            throw new Error(
              responseData.error || `HTTP error! status: ${response.status}`
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
            setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1))
          );
        }
      }

      // Validate the response data
      if (
        !responseData ||
        !responseData.content?.attributes ||
        !Array.isArray(responseData.content.attributes)
      ) {
        throw new Error("Invalid response format from server");
      }

      // Store the full thinking text and attributes
      if (responseData.thinking) {
        setFullThinking(responseData.thinking);
      }
      setAttributes(responseData.content.attributes);
      setLoading(false);
    } catch (error) {
      console.error("Error generating attributes:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate attributes"
      );
      setAttributes([]);
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);

      const { error: supabaseError } = await supabase
        .from("ideas")
        .update({
          signals: JSON.stringify(attributes), // Explicitly stringify the array
        })
        .eq("id", idea.id);

      if (supabaseError) throw supabaseError;

      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving attributes:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save attributes"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleAddAttribute(e: React.FormEvent) {
    e.preventDefault();
    if (newAttribute.trim() && attributes.length < 5) {
      setAttributes([...attributes, newAttribute.trim()]);
      setNewAttribute("");
    }
  }

  function handleDeleteAttribute(index: number) {
    setAttributes(attributes.filter((_, i) => i !== index));
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-h-[90vh] overflow-y-auto bg-background border border-accent-2 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              Idea Attributes
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-300">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-400 mb-4">
            {showAttributes
              ? "Here are the key attributes we've identified for your idea. Feel free to tweak them until they're just right."
              : "Analyzing your idea to identify key attributes..."}
          </Dialog.Description>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-900 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="dark:border-borderMainDark pb-0.5 border-b border-gray-700/50">
              <div className="group/goal research-goal" role="listitem">
                <button
                  type="button"
                  aria-expanded={expandedThinking}
                  onClick={() => setExpandedThinking(!expandedThinking)}
                  className="px-3 relative flex w-full items-stretch rounded-md text-left transition-all duration-200 ease-out focus-visible:outline-none hover:bg-accent-1 cursor-pointer"
                >
                  <span className="flex grow gap-[10px]">
                    <span className="relative flex w-4 shrink-0 flex-col items-center">
                      <span className="w-px border-l border-gray-600/50 h-[13px] opacity-0"></span>
                      <div>
                        <div className="relative">
                          <div
                            className="shrink-0 rounded-full border bg-gray-400/35 flex border-transparent"
                            style={{ width: "7px", height: "7px" }}
                          ></div>
                        </div>
                      </div>
                      <span className="w-px border-l border-gray-600/50 grow"></span>
                    </span>
                    <span className="select-none py-[6px] flex grow">
                      <div
                        className="overflow-hidden"
                        style={{
                          height: expandedThinking ? "auto" : "1.25rem",
                          maxHeight: expandedThinking ? "none" : "1.25rem",
                        }}
                      >
                        <div>
                          <span className="pr-3 text-pretty block text-sm text-gray-300">
                            <div>Analyzing your idea: {idea.name}</div>
                          </span>
                        </div>
                      </div>
                    </span>
                  </span>
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center">
                    <div
                      className="text-gray-400/60"
                      style={{
                        transform: expandedThinking
                          ? "rotate(-180deg)"
                          : "none",
                      }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </span>
                </button>

                {expandedThinking && (
                  <div className="group-only/goal:mb-3 group-last/goal:mb-1">
                    <div className="mr-6 w-full overflow-hidden">
                      <div className="gap-[10px] px-3 flex">
                        <div className="relative flex w-4 shrink-0 flex-col items-center">
                          <span className="w-px border-l border-gray-600/50 grow"></span>
                        </div>
                        <div className="pb-4 gap-y-2 flex flex-col group-last/goal:pb-0 group-only/goal:pb-0">
                          <div>
                            <div className="gap-y-1 mt-1.5">
                              <div className="mb-1 text-xs text-gray-400">
                                <span>Reading</span>
                              </div>
                              <div className="gap-2 flex flex-wrap">
                                <div className="gap-2 flex flex-wrap items-center">
                                  {readingItems.map((item, i) => (
                                    <div key={i} className="inline-flex">
                                      <div className="py-1 rounded-lg pl-1.5 pr-2.5 border-gray-600/50 transition duration-300 bg-accent-1 hover:bg-accent-2">
                                        <div className="flex items-center gap-x-1.5 border-gray-600/50 bg-transparent">
                                          <div className="line-clamp-1 break-all transition-all duration-300 !text-[0.7rem] font-mono text-xs text-gray-300">
                                            {item.name}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {showProcessing && (
                            <div className="animate-fadeIn">
                              <div className="gap-y-1 mt-1.5">
                                <div className="mb-1 text-xs text-gray-400">
                                  <span>Processing</span>
                                </div>
                                <div className="gap-2 flex flex-wrap">
                                  <div className="gap-2 flex flex-wrap items-center">
                                    {thinkingPhases.map((phase, i) => (
                                      <div key={i} className="inline-flex">
                                        <div className="py-1 rounded-lg px-2.5 pl-2 border-gray-600/50 bg-accent-1">
                                          <div className="gap-x-2 flex !text-[0.68rem] leading-4 font-mono text-xs text-gray-300">
                                            <div className="h-4 pt-px">
                                              <Search className="w-3.5 h-3.5" />
                                            </div>
                                            <p>{phase}</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {thinking && (
                            <div className="mt-4 animate-fadeIn">
                              <div className="gap-y-1">
                                <div className="mb-1 text-xs text-gray-400">
                                  <span>Thinking</span>
                                </div>
                                <div
                                  ref={thinkingRef}
                                  className="whitespace-pre-wrap max-h-[300px] overflow-y-auto bg-accent-1/30 border border-accent-2 rounded-md p-3 text-sm text-gray-400"
                                >
                                  {thinking}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {loading && !thinking && (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner className="w-6 h-6" />
              </div>
            )}

            {showAttributes && (
              <>
                <form onSubmit={handleAddAttribute} className="flex gap-2">
                  <input
                    type="text"
                    value={newAttribute}
                    onChange={(e) => setNewAttribute(e.target.value)}
                    placeholder="Add a new attribute..."
                    className="flex-1 px-3 py-2 bg-accent-1 border border-accent-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    disabled={attributes.length >= 5}
                  />
                  <button
                    type="submit"
                    disabled={!newAttribute.trim() || attributes.length >= 5}
                    className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-md hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                <div className="space-y-2">
                  {attributes.map((attribute, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-accent-1 border border-accent-2 rounded-md group"
                    >
                      <span className="text-sm">{attribute}</span>
                      <button
                        onClick={() => handleDeleteAttribute(index)}
                        className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Attributes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
