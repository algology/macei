export interface Resource {
  id: number;
  name: string;
  created_at: string;
  ideas?: Array<{ count: number }>;
  organization_id?: number;
  organization?: {
    id: number;
    name: string;
  };
}

export interface ResourceConfig {
  resourceName: string;
  iconType: "organization" | "mission" | "idea";
  tableName: string;
  foreignKey?: {
    name: string;
    value: string;
  };
}

export type Organization = {
  id: number;
  name: string;
  user_id: string;
  created_at: string;
  description?: string;
  website_url?: string;
  industry?: string;
  target_market?: string;
  missions?: Mission[];
};

export type Mission = {
  id: number;
  name: string;
  organization_id: number;
  created_at: string;
  description?: string;
  ideas?: { id: number; conviction?: string | null }[];
};

export type Idea = {
  id: number;
  name: string;
  mission_id: number;
  mission?: Mission;
  status: "validated" | "in review" | "ideation";
  summary?: string;
  signals?: string;
  created_at: string;
};

export type Profile = {
  id: string; // UUID
  full_name?: string;
  avatar_url?: string;
  updated_at?: string;
};

export type BreadcrumbItem = {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: "organization" | "mission" | "idea";
};

export interface AIAnalysisResult {
  missionAlignment: {
    score: number;
    analysis: string;
  };
  feasibility: {
    score: number;
    analysis: string;
  };
}

export type Document = {
  id: number;
  name: string;
  url: string;
  created_at: string;
};

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

export interface NewsResponse {
  status: string;
  articles: NewsArticle[];
}

export interface MarketSignal {
  title: string;
  description: string;
  url: string;
  source: string;
  date: string;
  type:
    | "news"
    | "academic"
    | "patents"
    | "trend"
    | "competitor"
    | "industry"
    | "funding";
  patentNumber?: string;
  status?: string;
  inventor?: string;
  relevanceScore?: number;
  trendDirection?: "up" | "down" | "stable";
  timeframe?: "recent" | "mid-term" | "long-term";
  sentiment?: "positive" | "negative" | "neutral";
  category?: string;
  impactLevel?: "high" | "medium" | "low";
}

export interface MarketSignalsResponse {
  signals: {
    news: MarketSignal[];
    academic: MarketSignal[];
    patents: MarketSignal[];
    trends: MarketSignal[];
    competitors: MarketSignal[];
    industry: MarketSignal[];
    funding: MarketSignal[];
  };
}

export interface IdeaAttribute {
  name: string;
  importance: number;
  current_assessment: string;
  risks: string;
  opportunities: string;
  evidence: string;
}

export interface DeepAnalysisResult {
  attributes: IdeaAttribute[];
  summary: string;
}

export interface IdeaInsight {
  insight: string;
  impact: string;
  source: string;
  date_added: string;
}

export interface IdeaDetails {
  id: number;
  name: string;
  status: "validated" | "in review" | "ideation";
  category: string;
  signals: string;
  created_at: string;
  conviction?: string;
  ai_analysis?: string;
  last_analyzed?: string;
  detailed_analysis?: string;
  insights?: IdeaInsight[];
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
