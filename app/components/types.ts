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
  ideas?: { count: number }[];
};

export type Idea = {
  id: number;
  name: string;
  mission_id: number;
  mission?: Mission;
  status: "validated" | "in review" | "ideation";
  category?: string;
  impact?: "High" | "Medium" | "Low";
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
  impact: {
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
