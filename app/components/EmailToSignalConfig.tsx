import { Clipboard, Mail, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  ideaId: number;
  ideaName: string;
}

export function EmailToSignalConfig({ ideaId, ideaName }: Props) {
  const [copied, setCopied] = useState(false);
  const emailAddress = `idea-${ideaId}@getmacy.com`;

  function copyEmailToClipboard() {
    navigator.clipboard.writeText(emailAddress).then(() => {
      setCopied(true);
      toast.success("Email address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-accent-1/50 border border-accent-2 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold">Email to Signal</h3>
        </div>
      </div>

      <p className="text-gray-400 text-sm">
        Send emails to the address below to automatically create market signals
        for "{ideaName}". Include links and text which will be analyzed and
        added to the knowledge base.
      </p>

      <div className="border border-accent-2 bg-accent-1/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-green-400 text-sm">{emailAddress}</div>
          <button
            onClick={copyEmailToClipboard}
            className="p-2 hover:bg-accent-1 rounded-lg transition-colors"
          >
            {copied ? (
              <Copy className="w-4 h-4 text-green-400" />
            ) : (
              <Clipboard className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <div className="bg-green-500/10 border border-green-900 rounded-lg p-4 text-sm text-gray-300">
        <h4 className="text-green-400 font-medium mb-2">
          Usage Tips & Compatibility
        </h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Include URLs in your email to automatically extract market signals
          </li>
          <li>
            Use a descriptive subject line that summarizes the key insight
          </li>
          <li>
            Content you send will be given higher relevance than automatically
            discovered signals
          </li>
          <li>Works with email forwarding and mobile email clients</li>
          <li>Compatible with newsletter subscriptions and direct emails</li>
          <li>Supports email-to-PDF services for document analysis</li>
        </ul>
      </div>
    </div>
  );
}
