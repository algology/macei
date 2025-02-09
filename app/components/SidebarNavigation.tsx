import Link from "next/link";
import { LayoutGrid, Database, Settings } from "lucide-react";

export function SidebarNavigation() {
  return (
    <aside className="w-40 border-r border-accent-2 p-4">
      <nav className="space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
        >
          <LayoutGrid className="w-4 h-4" />
          Dashboard
        </Link>
        <Link
          href="/dashboard/data"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
        >
          <Database className="w-4 h-4" />
          Data
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </nav>
    </aside>
  );
} 