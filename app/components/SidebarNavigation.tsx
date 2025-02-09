import Link from "next/link";
import {
  LayoutGrid,
  Database,
  Settings,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function SidebarNavigation({
  expanded = true,
  setExpanded,
}: {
  expanded?: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside
      className={`${
        expanded ? "w-60" : "w-16"
      } relative transition-all duration-200 border-r border-accent-2`}
    >
      <nav className="flex flex-col h-full p-4">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
          >
            <div className="w-16 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </div>
            {expanded && <span>Dashboard</span>}
          </Link>
          <Link
            href="/dashboard/data"
            className="flex items-center h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
          >
            <div className="w-16 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            {expanded && <span>Data</span>}
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
          >
            <div className="w-16 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            {expanded && <span>Settings</span>}
          </Link>
        </div>
        <div className="mt-auto">
          <div className="border-t border-accent-2 -mx-4 pt-4">
            <div className="px-4 space-y-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center w-full h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md"
              >
                <div className="w-16 flex items-center justify-center">
                  <PanelLeftClose
                    className={`w-4 h-4 transition-transform duration-200 ${
                      expanded ? "" : "rotate-180"
                    }`}
                  />
                </div>
                {expanded && <span>Collapse</span>}
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center w-full h-10 text-sm text-red-400 hover:text-red-300 hover:bg-accent-1 rounded-md"
              >
                <div className="w-16 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                {expanded && <span>Log Out</span>}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
