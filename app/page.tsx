"use client";

import {
  ArrowRight,
  Brain,
  LineChart,
  Target,
  Sparkles,
  MessageCircle,
  Send,
  ChevronRight,
  Globe,
  PlusCircle,
  MinusCircle,
  Plus,
  X,
  Star,
  Vote,
  Lightbulb,
  LayoutGrid,
  ArrowUpRight,
  Globe2,
  CheckCircle,
  Search,
  Newspaper,
  FileText,
} from "lucide-react";
import Image from "next/image";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Background } from "./components/Background";
import { HeroInstanceDashboard } from "./components/HeroInstanceDashboard";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "./components/LoadingSpinner";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { role: string; content: string }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<
    "signals" | "attributes" | "briefing"
  >("signals");
  const [previewData, setPreviewData] = useState<any>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [email, setEmail] = useState("");
  const [analysisThinking, setAnalysisThinking] = useState<string>("");
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState<
    "idle" | "attributes" | "searching" | "analyzing" | "complete"
  >("idle");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    attributes: true,
    search: true,
    sources: true,
    results: true,
  });
  const [readingProgress, setReadingProgress] = useState<{
    urls: string[];
    currentUrl: string | null;
    completedUrls: string[];
    status: "idle" | "reading" | "analyzing" | "complete";
  }>({
    urls: [],
    currentUrl: null,
    completedUrls: [],
    status: "idle",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add urlsBeingProcessed state to track which URLs are being read
  const [urlsBeingProcessed, setUrlsBeingProcessed] = useState<
    Array<{
      url: string;
      domain: string;
      status: "reading" | "completed" | "failed";
      category?: string;
    }>
  >([]);

  // Helper function to extract domain from URL
  const extractDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch (e) {
      console.error("Error extracting domain:", e);
      return url;
    }
  };

  // Helper function to get favicon URL for a domain
  const getFaviconUrl = (domain: string) => {
    // Use Google's favicon service for consistent cross-environment behavior
    // The double-encoding ensures special characters are properly handled
    const encodedDomain = encodeURIComponent(`https://${domain}`);
    return `https://www.google.com/s2/favicons?domain=${encodedDomain}&sz=32`;
  };

  // Helper function to render favicon with fallback
  const renderFavicon = (
    domain: string,
    status: "reading" | "completed" | "failed" = "completed"
  ) => {
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

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      } else {
        setIsLoading(false);
      }
    };

    checkUser();
  }, [router]);

  // Don't render anything while checking authentication
  if (isLoading) {
    return <Background />;
  }

  const handleSendMessage = async () => {
    if (!query.trim() || isProcessing) return;

    try {
      setIsProcessing(true);
      setCurrentAnalysisStep("attributes");
      setAnalysisThinking("");
      setUrlsBeingProcessed([]);

      // Add user message to chat
      setChatHistory((prev) => [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: "Analysing your idea..." },
      ]);

      // Clear the input
      setQuery("");

      // Reset preview data to ensure clean state
      setPreviewData({
        ideaName: query,
        attributes: [],
        signals: null,
        searchTerms: [],
        searchMeta: {
          totalResults: 0,
          searchTimestamp: new Date().toISOString(),
          queryTerms: [],
        },
      });

      // 1. First get idea attributes
      setAnalysisThinking(
        "Analysing idea and generating key attributes to monitor..."
      );
      const attributesResult = await processIdeaAttributes(query, false);

      if (!attributesResult || !attributesResult.attributes) {
        throw new Error("Failed to generate attributes");
      }

      const attributes = attributesResult.attributes;

      // Simulate Search Term Generation (Client-side for demo)
      const simulatedSearchTerms =
        attributes.length > 0
          ? [
              `${attributes[0]} market trends`,
              `${attributes[1] || query} analysis`,
              `${attributes[2] || attributes[0]} recent developments`,
              `competitor landscape analysis ${query}`,
              `funding environment ${query}`,
            ].slice(0, 5)
          : [`${query} market analysis`, `${query} competitive landscape`];

      // Update preview with attributes
      setPreviewData((prev: any) => ({
        ...prev,
        attributes: attributes,
        // searchTerms: simulatedSearchTerms, // Defer setting search terms
      }));
      // Still set current step to attributes as we're showing them first
      setCurrentAnalysisStep("attributes");
      setExpandedSections((prev) => ({ ...prev, attributes: true }));

      // Update chat with attributes info
      setChatHistory((prev) => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = {
          role: "assistant",
          content: `I've identified key attributes to monitor for "${query}". Now generating search terms...`,
        };
        return newHistory;
      });

      // Add a delay before showing search terms and moving to the next step
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

      // Now update with search terms and move to searching step
      setPreviewData((prev: any) => ({
        ...prev,
        searchTerms: simulatedSearchTerms,
      }));
      setCurrentAnalysisStep("searching");
      setExpandedSections((prev) => ({
        ...prev,
        attributes: false, // Optionally collapse attributes
        search: true,
      }));

      // Update chat again for search terms
      setChatHistory((prev) => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = {
          role: "assistant",
          content: `Generated search terms based on attributes. Now searching for relevant market signals...`,
        };
        return newHistory;
      });

      // 2. Fetch market signals using the attributes
      const signalsData = await processMarketSignals(query, attributes, false);

      // Ensure flow ends here for the landing page
      if (signalsData !== null) {
        // Check if signal processing completed (even if no URLs)
        setCurrentAnalysisStep("complete");
        setExpandedSections((prev) => ({
          ...prev,
          sources: false,
          results: true,
        })); // Collapse sources, expand results
        setShowSignupPrompt(true);
        // Update final chat message appropriately
        setChatHistory((prev) => {
          const newHistory = [...prev];
          const ideaDisplayName = query || "your idea";
          let updated = false;
          for (let i = newHistory.length - 1; i >= 0; i--) {
            if (newHistory[i].role === "assistant") {
              newHistory[
                i
              ].content = `I've identified attributes and found market signals for "${ideaDisplayName}". Sign up to get full briefings.`;
              updated = true;
              break;
            }
          }
          if (!updated) {
            newHistory.push({
              role: "assistant",
              content: `I've identified attributes and found market signals for "${ideaDisplayName}". Sign up to get full briefings.`,
            });
          }
          return newHistory;
        });
      } else {
        // Handle case where signal processing itself failed (error caught)
        setCurrentAnalysisStep("idle");
        // Error message already set in catch block
      }
    } catch (error) {
      console.error("Error processing message:", error);
      setCurrentAnalysisStep("idle");
      setExpandedSections({
        attributes: true,
        search: true,
        sources: true,
        results: true,
      });
      setChatHistory((prev) => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = {
          role: "assistant",
          content:
            "I encountered an error while analysing your idea. Please try again.",
        };
        return newHistory;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processIdeaAttributes = async (message: string, updateChat = true) => {
    try {
      // Create a sample idea from the user's message
      const response = await fetch("/api/generate-idea-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: message,
          summary: `An innovative concept related to: ${message}`,
          mission: "Exploring innovative business opportunities",
          organization: "11point2",
        }),
      });

      if (!response.ok) throw new Error("Failed to generate attributes");

      const data = await response.json();

      // If this is a direct call (not part of the combined flow), update the UI
      if (updateChat) {
        setPreviewData({
          ideaName: message,
          attributes: data.content.attributes,
          thinking: data.thinking,
        });

        // Update assistant message
        setChatHistory((prev) => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = {
            role: "assistant",
            content: `I've analysed your idea and identified key attributes to monitor for "${message}".`,
          };
          return newHistory;
        });

        setShowSignupPrompt(true);
      }

      // Return the data for combined processing
      return {
        attributes: data.content.attributes,
        thinking: data.thinking,
      };
    } catch (error) {
      throw error;
    }
  };

  const processMarketSignals = async (
    message: string,
    attributes: string[] = [],
    updateChat = true
  ) => {
    try {
      // Update analysis thinking to indicate we're searching
      setAnalysisThinking(
        "Searching for real-time market signals related to your idea...\n\nQuerying latest news sources, academic research, and market trends."
      );

      // Show processing indicator
      setIsProcessing(true);

      // Clear any existing URLs being processed
      setUrlsBeingProcessed([]);

      // Fetch market signals
      const response = await fetch("/api/fetch-market-signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ideaName: message,
          category: "technology", // Default category for landing page
          signals: JSON.stringify(attributes),
          isLandingPage: true, // Add this flag to indicate it's from landing page
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch market signals");
      }

      const data = await response.json();

      // Update analysis thinking with results
      setAnalysisThinking(
        (prev) =>
          prev +
          `\n\nFound ${data.signals?.news?.length || 0} news articles, ${
            data.signals?.trends?.length || 0
          } market trends, and ${
            data.signals?.academic?.length || 0
          } research papers.`
      );

      // Process all signals categories
      const processCategory = (items: any[] = [], category: string) => {
        return (
          items.map((item: any) => {
            if (item.url) {
              try {
                const domain = extractDomainFromUrl(item.url);
                return {
                  ...item,
                  domain,
                  category,
                };
              } catch (e) {
                console.error(`Error processing ${category} URL:`, e);
              }
            }
            return item;
          }) || []
        );
      };

      // Process each category
      const processedSignals = {
        news: processCategory(data.signals?.news, "News"),
        trends: processCategory(data.signals?.trends, "Trends"),
        academic: processCategory(data.signals?.academic, "Research"),
        patents: processCategory(data.signals?.patents, "Patents"),
        competitors: processCategory(data.signals?.competitors, "Competitors"),
        industry: processCategory(data.signals?.industry, "Industry"),
        funding: processCategory(data.signals?.funding, "Funding"),
      };

      // Collect all URLs to be processed from all categories
      const allUrls = [
        ...processedSignals.news,
        ...processedSignals.trends,
        ...processedSignals.academic,
        ...processedSignals.patents,
        ...processedSignals.competitors,
        ...processedSignals.industry,
        ...processedSignals.funding,
      ]
        .filter((signal) => signal?.url && signal.url.startsWith("http"))
        .slice(0, 10); // Limit to a reasonable number

      // Update analysis thinking about reading the articles
      setAnalysisThinking(
        (prev) =>
          prev + `\n\nReading and analysing ${allUrls.length} sources...`
      );

      // Initialize all URLs as "reading" status
      const tempUrls = allUrls.map((item) => ({
        url: item.url,
        domain: item.domain || extractDomainFromUrl(item.url),
        status: "reading" as const,
        category: item.category || "Source",
      }));

      if (tempUrls.length > 0) {
        setUrlsBeingProcessed(tempUrls);
        setCurrentAnalysisStep("analyzing");
        setExpandedSections((prev) => ({
          ...prev,
          search: false,
          sources: true,
        }));

        // Simulate the reading process with realistic staggered completion
        const analysisPromises = [];
        for (let i = 0; i < tempUrls.length; i++) {
          // Different articles take different times to read (500-2500ms)
          const delay = 500 + Math.random() * 2000;

          // Simulate a small percentage of failures
          const willFail = Math.random() < 0.1; // 10% chance of failure

          // Use a timeout to update the status after the "reading" time
          const analysisPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              setUrlsBeingProcessed((current) =>
                current.map((item, idx) =>
                  idx === i
                    ? {
                        ...item,
                        status: willFail ? "failed" : "completed",
                      }
                    : item
                )
              );

              // Update analysis thinking
              setAnalysisThinking(
                (prev) =>
                  prev +
                  `\n${willFail ? "✗" : "✓"} ${
                    willFail ? "Failed to analyse" : "Analysed"
                  } source: ${tempUrls[i].domain}`
              );

              resolve(); // Resolve promise when timeout finishes
            }, delay);
          });
          analysisPromises.push(analysisPromise);

          // Add a small delay between starting to process URLs to make it look more realistic
          if (i < tempUrls.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        // Wait for all analysis timeouts to complete before proceeding
        await Promise.all(analysisPromises);

        // Add search metadata
        const previewDataFormatted = {
          ideaName: message,
          searchMeta: {
            totalResults: Object.values(processedSignals).flat().length,
            searchTimestamp: new Date().toISOString(),
            queryTerms: attributes.length > 0 ? attributes : [message],
          },
          signals: processedSignals,
        };

        // Update UI with the market signals
        if (updateChat) {
          setPreviewData(previewDataFormatted);

          // Update assistant message
          setChatHistory((prev) => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              role: "assistant",
              content: `I've found some relevant market signals for "${message}" based on the key attributes.`,
            };
            return newHistory;
          });

          setActivePreviewTab("signals");
        }

        // Return the signals data for further processing if needed
        return processedSignals;
      } else {
        // No URLs found
        setUrlsBeingProcessed([]);
        setAnalysisThinking(
          (prev) => prev + "\n\nNo specific sources found to analyse."
        );
        // No need to set state to complete or show signup here, handleSendMessage does it.
      }
    } catch (error) {
      console.error("Error processing market signals:", error);

      // Update analysis thinking with error
      setAnalysisThinking(
        (prev) =>
          prev + "\n\nEncountered an error while processing market signals."
      );

      // Mark URLs being processed as failed
      setUrlsBeingProcessed((current) =>
        current.map((item) => ({ ...item, status: "failed" }))
      );

      return null;
    }
  };

  const processBriefing = async (
    attributes: string[],
    signalsData: any,
    category: string
  ) => {
    // Show thinking indicator for briefing generation
    setAnalysisThinking(
      "Generating a comprehensive briefing based on the market signals..."
    );

    // Initialize processedDetails with extracted data from signalsData, handling null case
    const processedDetails = {
      news: signalsData?.news || [],
      trends: signalsData?.trends || [],
      research: signalsData?.academic || [],
    };

    // Process domains for detailed sources
    const detailedSources = (processedDetails.news || []).map(
      (newsItem: any) => {
        if (!newsItem || !newsItem.url) return newsItem;
        try {
          const domain = extractDomainFromUrl(newsItem.url);
          return {
            ...newsItem,
            domain,
          };
        } catch (e) {
          console.error("Error processing URL for favicon:", e);
          return newsItem;
        }
      }
    );

    // Update thinking indicator with more details
    setAnalysisThinking(
      "Creating briefing with key insights, opportunities, and next steps..."
    );

    try {
      const response = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ideaName: query,
          signals: signalsData || {},
          isLandingPage: true,
          attributes: Array.isArray(attributes) ? attributes : [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate briefing");
      }

      const data = await response.json();

      // Extract the conviction from the data or use "Undetermined" as fallback
      const conviction = data.conviction || "Undetermined";

      // Use real data from API response or fallback to our constructed briefing with data from signals
      const briefingData = {
        summary:
          data.summary ||
          `Analysis for "${query}" based on market intelligence and idea validation. ${
            attributes.length > 0
              ? `Key areas to monitor include ${attributes
                  .slice(0, 3)
                  .join(", ")}.`
              : ""
          }`,
        // Use details from response or fallback to processing signals data
        details: data.details || processedDetails,
        conviction: conviction || "Undetermined",
        key_opportunities: data.key_opportunities || [
          attributes[0]
            ? `Leverage ${attributes[0]} for competitive advantage`
            : "First-mover advantage in emerging markets",
          attributes[1]
            ? `Develop solutions addressing ${attributes[1]}`
            : "Partnership with established technology providers",
          "Expansion into adjacent market segments",
        ],
        key_challenges: data.key_challenges || [
          "Increasing competition from established players",
          attributes[2]
            ? `Navigating complex ${attributes[2]} landscape`
            : "Need for specialised talent",
          "Evolving regulatory requirements",
        ],
        // Add search metadata
        searchMeta: {
          generatedAt: new Date().toISOString(),
          dataPoints: (data.details?.length || 0) + attributes.length,
          queryTerms:
            attributes.length > 0
              ? attributes
              : [
                  "Market analysis",
                  "Competitive landscape",
                  "Strategic positioning",
                ],
        },
      };

      // Update analysis thinking with briefing generation completion
      setAnalysisThinking(
        (prev) =>
          prev +
          `\n\nBriefing generation complete. Analysed ${briefingData.searchMeta.dataPoints} data points to create comprehensive report.`
      );

      // When completed, update the UI if this is a direct call
      if (query) {
        setPreviewData({
          ideaName: query,
          attributes: attributes,
          signals: signalsData,
          briefing: briefingData,
        });

        // Update assistant message
        setChatHistory((prev) => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = {
            role: "assistant",
            content: `I've prepared a complete analysis for "${query}". This includes key attributes to monitor, relevant market signals, and a comprehensive briefing note.`,
          };
          return newHistory;
        });

        setShowSignupPrompt(true);
      }

      // Return the briefing for combined processing
      return briefingData;
    } catch (error) {
      console.error("Error processing briefing:", error);

      // Fallback to using signals data directly if API call fails
      const topNews = signalsData?.news?.[0];
      const topTrend = signalsData?.trends?.[0];
      const topResearch = signalsData?.academic?.[0];

      // Process sources to include favicon URLs
      const processedDetails = [
        topNews
          ? {
              summary: topNews.title,
              url: topNews.url || "#",
              emoji: "📰",
              source_name: topNews.source || "News Source",
              faviconUrl: topNews.faviconUrl || null,
            }
          : {
              summary: `The global market for ${query} solutions is expected to grow significantly in the coming years.`,
              url: "#",
              emoji: "📈",
              source_name: "Market Research",
              faviconUrl: null,
            },
        topTrend
          ? {
              summary: topTrend.title,
              url: topTrend.url || "#",
              emoji: "📊",
              source_name: topTrend.source || "Trend Analysis",
              faviconUrl: null,
            }
          : {
              summary:
                "New technological developments are making implementation more cost-effective.",
              url: "#",
              emoji: "💡",
              source_name: "Technology Journal",
              faviconUrl: null,
            },
        topResearch
          ? {
              summary: topResearch.title,
              url: topResearch.url || "#",
              emoji: "🔬",
              source_name: topResearch.source || "Research Paper",
              faviconUrl: null,
            }
          : {
              summary:
                "Regulatory changes in key markets are creating new opportunities for early adopters.",
              url: "#",
              emoji: "🏛️",
              source_name: "Regulatory Update",
              faviconUrl: null,
            },
      ];

      // Process domain for detailed sources
      processedDetails.forEach((detail) => {
        if (detail.url && detail.url !== "#") {
          try {
            const url = new URL(detail.url);
            const domain = url.hostname;
            detail.faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
          } catch (e) {
            console.error("Error parsing URL for favicon:", e);
          }
        }
      });

      // Create a fallback briefing with what we have
      const fallbackBriefing = {
        summary: `Analysis for "${query}" based on market intelligence and idea validation. ${
          attributes.length > 0
            ? `Key areas to monitor include ${attributes
                .slice(0, 3)
                .join(", ")}.`
            : ""
        } ${topNews ? `Recent developments show ${topNews.title}.` : ""}`,
        details: processedDetails,
        conviction: "Undetermined", // Use a label instead of a score
        key_opportunities: [
          attributes[0]
            ? `Leverage ${attributes[0]} for competitive advantage`
            : "First-mover advantage in emerging markets",
          attributes[1]
            ? `Develop solutions addressing ${attributes[1]}`
            : "Partnership with established technology providers",
          "Expansion into adjacent market segments",
        ],
        key_challenges: [
          "Increasing competition from established players",
          attributes[2]
            ? `Navigating complex ${attributes[2]} landscape`
            : "Need for specialised talent",
          "Evolving regulatory requirements",
        ],
        // Add search metadata
        searchMeta: {
          generatedAt: new Date().toISOString(),
          dataPoints:
            (Array.isArray(processedDetails) ? processedDetails.length : 0) +
            attributes.length,
          queryTerms:
            attributes.length > 0
              ? attributes
              : [
                  "Market analysis",
                  "Competitive landscape",
                  "Strategic positioning",
                ],
        },
      };

      // If this is a direct call, update the UI with the fallback
      if (query) {
        setPreviewData({
          ideaName: query,
          briefing: fallbackBriefing,
        });
      }

      return fallbackBriefing;
    }
  };

  const handleSignupPrompt = async () => {
    if (!email.trim() || !email.includes("@")) {
      return; // Basic validation
    }

    // Create a message that properly handles the type
    let reportType = "";
    if (activePreviewTab === "signals") {
      reportType = "market signals report";
    } else if (activePreviewTab === "attributes") {
      reportType = "idea attributes analysis";
    } else {
      reportType = "briefing";
    }

    setChatHistory((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Thanks for your email! We'll send your full ${reportType} to ${email} and keep you updated with periodic insights.`,
      },
    ]);

    setShowSignupPrompt(false);
    setEmail("");

    // Here you would normally send this to your backend to register the user
    console.log("User email for signup:", email);
  };

  const renderPreview = () => {
    const stepOrder: Array<{
      key: string;
      title: string;
      icon: React.ReactNode;
      condition: boolean;
      step: typeof currentAnalysisStep | "all"; // When this step is considered "active" or "complete"
    }> = [
      {
        key: "attributes",
        title: "Generated Attributes",
        icon: <Brain className="w-4 h-4" />,
        condition: !!previewData?.attributes?.length,
        step: "attributes",
      },
      {
        key: "search",
        title: "Search Terms Used",
        icon: <Search className="w-4 h-4" />,
        condition: !!previewData?.attributes?.length,
        step: "searching",
      },
      {
        key: "sources",
        title: "Sources Being Analysed",
        icon: <Globe className="w-4 h-4" />,
        condition: urlsBeingProcessed.length > 0,
        step: "analyzing",
      },
      {
        key: "results",
        title: "Market Signal Results",
        icon: <Newspaper className="w-4 h-4" />,
        condition: !!previewData?.signals?.news?.length,
        step: "complete",
      },
      {
        key: "briefing",
        title: "Generated Briefing",
        icon: <FileText className="w-4 h-4" />,
        condition: currentAnalysisStep === "complete",
        step: "complete",
      },
    ];

    const isStepComplete = (stepKey: typeof currentAnalysisStep | "all") => {
      const order = ["attributes", "searching", "analyzing", "complete"];
      const currentIdx = order.indexOf(currentAnalysisStep);
      const stepIdx = order.indexOf(stepKey as string);
      return stepIdx < currentIdx;
    };

    const isStepActive = (stepKey: typeof currentAnalysisStep | "all") => {
      return stepKey === currentAnalysisStep;
    };

    return (
      <div className="space-y-4">
        {stepOrder.map((section, index) => {
          if (!section.condition) return null; // Don't render if condition not met

          const isComplete = isStepComplete(section.step);
          const isActive = isStepActive(section.step);
          const isExpanded = expandedSections[section.key];

          return (
            <div
              key={section.key}
              className={`bg-accent-1/30 rounded-lg border border-accent-2 transition-all duration-300 ease-in-out ${
                isComplete && !isExpanded ? "opacity-60" : "opacity-100"
              }`}
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.key)}
                className={`w-full flex items-center justify-between p-3 text-left font-medium text-sm ${
                  isActive ? "text-green-400" : "text-gray-300"
                } hover:bg-accent-1/50`}
              >
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : isActive ? (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                  ) : (
                    <div className="w-4 h-4 text-gray-600">{section.icon}</div>
                  )}
                  <span>{section.title}</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : "rotate-0"
                  }`}
                />
              </button>

              {/* Section Content (Collapsible) */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded
                    ? "max-h-[1000px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="p-4 border-t border-accent-2">
                  {section.key === "attributes" && (
                    <div className="flex flex-wrap gap-2">
                      {previewData.attributes.map(
                        (attribute: string, index: number) => (
                          <div
                            key={index}
                            className="px-3 py-1 bg-green-500/10 rounded-full text-xs text-green-300 border border-green-800/50"
                          >
                            {attribute}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {section.key === "search" && (
                    <div className="flex flex-wrap gap-2">
                      {previewData?.searchTerms?.map(
                        (term: string, index: number) => (
                          <div
                            key={index}
                            className="px-3 py-1 bg-purple-500/5 rounded-full text-xs text-purple-300 border border-purple-800/30"
                          >
                            {term}
                          </div>
                        )
                      )}
                      {(!previewData?.searchTerms ||
                        previewData.searchTerms.length === 0) && (
                        <p className="text-xs text-gray-500 italic">
                          No search terms generated yet.
                        </p>
                      )}
                    </div>
                  )}
                  {section.key === "sources" && (
                    <div className="flex flex-wrap gap-2">
                      {urlsBeingProcessed.slice(0, 10).map((urlStatus, idx) => {
                        const displayDomain = urlStatus.domain.replace(
                          /^www\./,
                          ""
                        );
                        return (
                          <a
                            key={idx}
                            href={urlStatus.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`py-1.5 px-2.5 rounded-lg bg-accent-1/20 hover:bg-accent-1/30 transition-colors duration-300 border border-transparent ${
                              urlStatus.status === "reading"
                                ? "border-green-500/20"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {renderFavicon(
                                urlStatus.domain,
                                urlStatus.status
                              )}
                              <div className="line-clamp-1 break-all text-xs font-mono">
                                {displayDomain}
                              </div>
                              {urlStatus.status === "reading" && (
                                <LoadingSpinner className="w-3 h-3 ml-1" />
                              )}
                            </div>
                          </a>
                        );
                      })}
                      {urlsBeingProcessed.length > 10 && (
                        <div className="mt-3 text-center w-full">
                          <span className="text-xs text-gray-400">
                            +{urlsBeingProcessed.length - 10} more sources
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {section.key === "results" && (
                    <div className="space-y-3">
                      {previewData.signals.news
                        .slice(0, 3)
                        .map((item: any, index: number) => (
                          <div
                            key={index}
                            className="p-3 rounded-lg bg-black/10"
                          >
                            <div className="flex items-start gap-2">
                              {item.domain &&
                                renderFavicon(item.domain, "completed")}
                              <div className="flex-1">
                                <h6 className="font-medium text-white text-sm">
                                  {item.title}
                                </h6>
                                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                                {item.url && (
                                  <div className="flex justify-end mt-2">
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-500 text-xs flex items-center"
                                    >
                                      Read more{" "}
                                      <ChevronRight className="w-3 h-3 ml-1" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  {section.key === "briefing" && (
                    <div className="space-y-4 text-center">
                      <p className="text-sm text-gray-400 mb-3">
                        Your weekly briefing monitors market shifts, competitor
                        moves, and new opportunities for this idea.
                      </p>
                      <button
                        onClick={() => router.push("/signup")}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors"
                      >
                        Sign Up for Full Briefings & Idea Conviction
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Function to toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <>
      <Background />
      <div className="relative">
        <Header />

        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/80 via-transparent to-background/80" />

          <div className="max-w-7xl mx-auto px-4 relative z-10 py-20">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent-1/50 border border-accent-2 mb-8">
                <Sparkles className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-sm font-mono text-gray-400">
                  INTRODUCING MACY
                </span>
              </div>
              <h1 className="text-6xl md:text-8xl font-normal mb-8 leading-tight tracking-tight">
                Break Free from the
                <span className="gradient-text block mt-2">
                  Innovator&apos;s Dilemma
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-grey-400 max-w-2xl mb-12 leading-relaxed">
                Your AI co-founder that monitors market trends and validates new
                opportunities. Macy helps you stay ahead of competitors and make
                data-driven decisions about your next big idea.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <a
                  href="#chat"
                  className="group px-8 py-4 bg-green-500 text-black rounded-full hover:bg-green-400 transition-colors duration-200 font-medium flex items-center gap-2 text-lg"
                >
                  Try Macy
                </a>
                <div className="flex items-center gap-4 text-gray-400">
                  <div className="w-12 h-px bg-gray-800" />
                  <span className="text-sm">No signup required</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Conversation Interface Section */}
        <section
          id="chat"
          className="py-20 border-y border-accent-2 bg-background/40"
        >
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent-1/50 border border-accent-2 mb-4">
                <MessageCircle className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-sm font-mono text-gray-400">
                  ASK MACY
                </span>
              </div>
              <h2 className="text-4xl font-medium mb-4">
                What business idea are you exploring?
              </h2>
              <p className="text-xl text-grey-400 max-w-2xl mx-auto">
                Tell Macy about your idea and get instant insights, market
                signals, and a briefing note.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Chat Interface */}
              <div className="lg:col-span-2 flex flex-col bg-accent-1/30 backdrop-blur-sm border border-accent-2 rounded-2xl h-[600px]">
                <div className="p-4 border-b border-accent-2">
                  <h3 className="font-medium">Conversation with Macy</h3>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageCircle className="w-12 h-12 text-gray-600 mb-4" />
                      <p className="text-grey-400">
                        Ask about a business idea to get started
                      </p>
                      <div className="grid grid-cols-1 gap-2 mt-6 w-full max-w-xs">
                        <button
                          onClick={() => {
                            setQuery(
                              "Tell me about sustainable farming technology"
                            );
                            setTimeout(() => handleSendMessage(), 100);
                          }}
                          className="text-left text-sm bg-accent-1/30 hover:bg-accent-1/50 py-2 px-3 rounded-lg border border-accent-2/50 text-gray-300"
                        >
                          Tell me about sustainable farming technology
                        </button>
                        <button
                          onClick={() => {
                            setQuery(
                              "I want to build an AI-powered fitness coaching app"
                            );
                            setTimeout(() => handleSendMessage(), 100);
                          }}
                          className="text-left text-sm bg-accent-1/30 hover:bg-accent-1/50 py-2 px-3 rounded-lg border border-accent-2/50 text-gray-300"
                        >
                          I want to build an AI-powered fitness coaching app
                        </button>
                        <button
                          onClick={() => {
                            setQuery(
                              "Generate a briefing on renewable energy storage"
                            );
                            setTimeout(() => handleSendMessage(), 100);
                          }}
                          className="text-left text-sm bg-accent-1/30 hover:bg-accent-1/50 py-2 px-3 rounded-lg border border-accent-2/50 text-gray-300"
                        >
                          Generate a briefing on renewable energy storage
                        </button>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === "user"
                              ? "bg-green-500 text-black rounded-tr-none"
                              : "bg-accent-1 text-white rounded-tl-none"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-accent-2">
                  {previewData && showSignupPrompt ? (
                    <div className="flex flex-col space-y-3 text-center">
                      <p className="text-sm text-gray-300">
                        Sign up to get full analysis and weekly updates:
                      </p>
                      <button
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-900 rounded-lg hover:bg-green-500/30 transition-colors"
                        onClick={() => router.push("/signup")}
                      >
                        Sign Up for Full Access
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex items-center justify-center text-sm text-gray-400">
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Analysing idea...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSendMessage()
                        }
                        placeholder="Describe your business idea..."
                        className="flex-1 bg-white/90 border border-gray-400/50 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-black placeholder-gray-500 shadow-sm"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isProcessing}
                        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                          isProcessing
                            ? "bg-gray-400 text-gray-600"
                            : "bg-green-500 text-black hover:bg-green-400"
                        } transition-colors active:scale-[0.97]`}
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Panel */}
              <div className="lg:col-span-3 bg-accent-1/30 backdrop-blur-sm border border-accent-2 rounded-2xl p-6 h-[600px] overflow-y-auto">
                {previewData ? (
                  renderPreview()
                ) : readingProgress.status !== "idle" ? (
                  <div className="space-y-6">
                    {/* Reading Progress Visualization */}
                    <div className="bg-accent-1/30 p-4 rounded-lg border border-accent-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm text-gray-400 uppercase">
                          Analysing Market Data
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          {readingProgress.status === "reading"
                            ? "Reading articles..."
                            : readingProgress.status === "analyzing"
                            ? "Synthesizing data..."
                            : "Processing..."}
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {readingProgress.urls.map((url, index) => {
                          // Extract domain for favicon
                          let domain = "";
                          try {
                            const urlObj = new URL(url);
                            domain = urlObj.hostname;
                          } catch (e) {
                            console.error("Error parsing URL:", e);
                          }

                          const isReading = url === readingProgress.currentUrl;
                          const isCompleted =
                            readingProgress.completedUrls.includes(url);

                          return (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-3 p-2 rounded-lg ${
                                isReading
                                  ? "bg-green-500/10 border border-green-500/20"
                                  : isCompleted
                                  ? "bg-black/20 opacity-70"
                                  : "bg-black/10"
                              } hover:bg-accent-1/50 transition-colours duration-300`}
                            >
                              <div className="flex items-center gap-2 w-8">
                                {isReading && (
                                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                )}
                                {isCompleted && (
                                  <div className="w-4 h-4 text-green-500">
                                    ✓
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                {domain && (
                                  <div className="relative flex-none">
                                    <div className="relative overflow-hidden rounded-full">
                                      <div className="rounded-inherit absolute inset-0 bg-white"></div>
                                      <img
                                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                        alt=""
                                        className={`relative block w-4 h-4 z-10 ${
                                          isReading ? "animate-pulse" : ""
                                        }`}
                                        onError={(e) => {
                                          // If favicon fails to load, show fallback
                                          const target =
                                            e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          target.nextElementSibling?.classList.remove(
                                            "hidden"
                                          );
                                        }}
                                      />
                                      {/* Fallback icon for when favicon fails to load */}
                                      <div className="absolute inset-0 bg-gray-500 text-white items-center justify-center  flex">
                                        <Globe className="w-3 h-3" />
                                      </div>
                                      <div className="rounded-inherit absolute inset-0 border border-[rgba(0,0,0,0.1)] dark:border-transparent"></div>
                                    </div>
                                  </div>
                                )}
                                <span
                                  className={`text-xs font-mono ${
                                    isReading
                                      ? "text-green-400 font-medium"
                                      : "text-gray-300"
                                  }`}
                                >
                                  {domain || url}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {isReading
                                  ? "Reading..."
                                  : isCompleted
                                  ? "Analysed"
                                  : "Pending"}
                              </div>
                            </a>
                          );
                        })}
                      </div>

                      {/* Analysis Progress */}
                      {readingProgress.status === "analyzing" && (
                        <div className="mt-6">
                          <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full w-full animate-pulse"></div>
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-gray-400">
                            <span>Generating insights</span>
                            <span>Finalising briefing</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Analysis Thinking */}
                    {analysisThinking && (
                      <div className="bg-accent-1/30 p-4 rounded-lg border border-accent-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm text-gray-400 uppercase">
                            Analysis Process
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            Processing...
                          </div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-lg">
                          <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">
                            {analysisThinking}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6 text-green-500">
                      <Brain className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      Business Intelligence Preview
                    </h3>
                    <p className="text-grey-400 max-w-md">
                      Ask Macy about your business idea to see market signals,
                      key attributes to monitor, or get a detailed briefing
                      note.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="border-y border-accent-2 bg-background/30 backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-grey-400 mb-8">
                TRUSTED BY INNOVATIVE TEAM AT
              </p>
              <div className="flex justify-center items-center gap-12">
                <Image
                  src="/11point2logo.png"
                  alt="11point2 Logo"
                  width={180}
                  height={60}
                  className="opacity-60 hover:opacity-100 hover:scale-105 transition-all duration-300 grayscale"
                  style={{ height: "auto" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Value Proposition Section */}
        <section className="py-32 bg-background/20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent-1/50 border border-accent-2 mb-4">
                  <Brain className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="text-sm font-mono text-gray-400">
                    WHY MACY
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                  Turn Market Signals into
                  <span className="gradient-text"> Strategic Advantage</span>
                </h2>
                <p className="text-xl text-grey-400 leading-relaxed">
                  The Macy AI agent continuously analyses market signals,
                  research papers, and industry trends to help you validate
                  ideas with confidence and discover new opportunities before
                  they become obvious.
                </p>
              </div>
              <div className="relative w-full">
                <HeroInstanceDashboard />
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-32 bg-background/30 backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold mb-8">
                Everything you need to
                <span className="gradient-text block mt-2">
                  Validate Ideas Fast
                </span>
              </h2>
              <p className="text-xl text-grey-400 max-w-2xl mx-auto">
                Our platform combines AI-powered analysis with human expertise
                to help you make confident decisions about new opportunities.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Brain className="w-8 h-8" />}
                title="AI-Powered Analysis"
                description="Continuous monitoring and analysis of market signals, trends, and opportunities"
              />
              <FeatureCard
                icon={<LineChart className="w-8 h-8" />}
                title="Real-time Insights"
                description="Track market movements and get instant alerts about relevant changes"
              />
              <FeatureCard
                icon={<Target className="w-8 h-8" />}
                title="Strategic Recommendations"
                description="Get actionable insights and clear next steps for your innovation initiatives"
              />
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-2xl p-8 hover:border-green-500/50 transition-colours">
      <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6 text-green-500">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
