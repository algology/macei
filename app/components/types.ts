export type Organization = {
  id: number;
  name: string;
  created_at: string;
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
  created_at: string;
};

export type BreadcrumbItem = {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: "organization" | "mission" | "idea";
};
