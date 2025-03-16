import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Trash2 } from "lucide-react";
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (
        !data.content?.attributes ||
        !Array.isArray(data.content.attributes)
      ) {
        throw new Error("Invalid response format from server");
      }

      // Store the full thinking text and attributes
      if (data.thinking) {
        setFullThinking(data.thinking);
      }
      setAttributes(data.content.attributes);
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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] bg-background border border-accent-2 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              Idea Attributes
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-300">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-400 mb-4">
            {loading || thinking
              ? "Hold tight while our AI dives deep into your idea... it's like finding needles in a haystack, but the needles are made of gold!"
              : "Here are the key attributes we've identified for your idea. Feel free to tweak them until they're just right."}
          </Dialog.Description>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-900 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {loading && !thinking && (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner className="w-6 h-6" />
              </div>
            )}

            {thinking && (
              <div
                ref={thinkingRef}
                className="bg-accent-1/30 border border-accent-2 rounded-md p-3 h-32 overflow-y-auto mb-4 transition-all duration-500"
              >
                <p className="text-sm text-gray-400 italic whitespace-pre-wrap">
                  {thinking}
                </p>
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
