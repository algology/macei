"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";

interface Props {
  ideaId: number;
  ideaName: string;
  onToggle: () => void;
  isExpanded?: boolean;
}

export function KnowledgeBaseChatIcon({
  ideaId,
  ideaName,
  onToggle,
  isExpanded = false,
}: Props) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-6 right-20 z-50 w-12 h-12 rounded-full bg-green-500/20 text-green-400 border border-green-900 flex items-center justify-center shadow-lg hover:bg-green-500/30 transition-colors"
      aria-label="Toggle knowledge base chat"
      title={`Chat with ${ideaName} knowledge base`}
    >
      <MessageSquare className="w-5 h-5" />
    </button>
  );
}
