"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as Dialog from "@radix-ui/react-dialog";
import {
  MessageSquare,
  X,
  Star,
  AlertCircle,
  Send,
  ThumbsUp,
  SmilePlus,
} from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";

interface Props {
  ideaId?: number;
  missionId?: number;
  organizationId?: number;
  component?: string;
  variant?: "floating" | "inline" | "minimal";
  showRating?: boolean;
  prompt?: string;
  onFeedbackSubmitted?: () => void;
}

export function FeedbackWidget({
  ideaId,
  missionId,
  organizationId,
  component,
  variant = "floating",
  showRating = true,
  prompt = "Help us improve! Share your feedback",
  onFeedbackSubmitted,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Get current auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      setError("Please enter your feedback");
      return;
    }

    if (!user) {
      setError("You must be logged in to submit feedback");
      return;
    }

    try {
      setError(null);
      setSubmitting(true);

      // Submit feedback to Supabase
      const { error: submitError } = await supabase.from("feedback").insert({
        user_id: user.id,
        content: feedback,
        page_url: pathname,
        component: component || null,
        rating: rating,
        idea_id: ideaId || null,
        mission_id: missionId || null,
        organization_id: organizationId || null,
        tags: component ? [component] : [],
      });

      if (submitError) throw submitError;

      // Reset form
      setFeedback("");
      setRating(null);
      setIsOpen(false);

      // Show success message
      toast.success("Feedback submitted", {
        description: "Thank you for helping us improve!",
        icon: <ThumbsUp className="w-4 h-4" />,
      });

      // Trigger callback if provided
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError(
        err instanceof Error ? err.message : "Failed to submit feedback"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Render different button styles based on variant
  const renderButton = () => {
    switch (variant) {
      case "floating":
        return (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gray-500/20 text-gray-400 border border-gray-800 flex items-center justify-center shadow-lg hover:bg-gray-500/30 transition-colors"
            aria-label="Open feedback form"
          >
            <SmilePlus className="w-5 h-5" />
          </button>
        );
      case "inline":
        return (
          <button
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2"
          >
            <SmilePlus className="w-4 h-4" />
            Feedback
          </button>
        );
      case "minimal":
        return (
          <button
            onClick={() => setIsOpen(true)}
            className="text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 text-sm"
          >
            <SmilePlus className="w-4 h-4" />
            Feedback
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {renderButton()}

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-h-[85vh] overflow-y-auto bg-background border border-accent-2 rounded-lg shadow-lg p-6 z-50">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium flex items-center gap-2">
                <SmilePlus className="w-5 h-5 text-gray-400" />
                Beta Feedback
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-300">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <Dialog.Description className="text-sm text-gray-300 mb-4">
              {prompt}
            </Dialog.Description>

            {error && (
              <div className="bg-red-500/10 text-red-400 border border-red-900 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {showRating && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rate your experience
                  </label>

                  <div className="flex flex-col">
                    <div className="flex justify-between w-full mb-1 gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          onClick={() => setRating(value)}
                          className={`flex-1 h-12 rounded flex items-center justify-center ${
                            rating !== null && value <= rating
                              ? "bg-green-500/30 text-green-400 border border-green-900"
                              : "bg-accent-1/50 text-gray-400 hover:bg-accent-1 border border-accent-2"
                          }`}
                        >
                          <Star
                            className={`w-5 h-5 ${
                              rating !== null && value <= rating
                                ? "fill-green-400"
                                : ""
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between w-full px-1 text-xs text-gray-400">
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="feedback"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Your feedback
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what you think, report issues, or suggest improvements..."
                  className="w-full h-32 bg-accent-1/50 border border-accent-2 rounded-lg p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  disabled={submitting}
                />
              </div>

              <div className="text-xs text-gray-400">
                <p>
                  Feedback is associated with your account and this page URL to
                  help us better understand the context.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !feedback.trim()}
                className="w-full px-4 py-3 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner className="w-4 h-4" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
