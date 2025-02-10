export interface Resource {
  id: number;
  name: string;
  created_at: string;
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
  user_id: string; // UUID from auth.users
  created_at: string;
  missions?: Mission[];
};

export type Mission = {
  id: number;
  name: string;
  organization_id: number;
  created_at: string;
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
