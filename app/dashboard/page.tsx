import { OrganizationCards } from "@/app/components/OrganizationCards";
import { DashboardLayout } from "@/app/components/DashboardLayout";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <OrganizationCards />
    </DashboardLayout>
  );
}
