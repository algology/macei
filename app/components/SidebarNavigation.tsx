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
import * as Tooltip from "@radix-ui/react-tooltip";

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

  const NavLink = ({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
  }) => (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Link
            href={href}
            className={`flex items-center h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md ${
              !expanded ? "justify-center px-2" : ""
            }`}
          >
            <div
              className={`${
                expanded ? "w-16" : "w-12"
              } flex items-center justify-center`}
            >
              {icon}
            </div>
            {expanded && <span>{label}</span>}
          </Link>
        </Tooltip.Trigger>
        {!expanded && (
          <Tooltip.Portal>
            <Tooltip.Content
              className="px-3 py-1.5 text-sm bg-accent-1 border border-accent-2 rounded-md"
              side="right"
              sideOffset={8}
            >
              {label}
              <Tooltip.Arrow className="fill-accent-1" />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );

  return (
    <aside
      className={`${
        expanded ? "w-52" : "w-20"
      } relative transition-all duration-200 border-r border-accent-2`}
    >
      <nav className="flex flex-col h-full p-4">
        <div className="space-y-1">
          <NavLink
            href="/dashboard"
            icon={<LayoutGrid className="w-4 h-4" />}
            label="Dashboard"
          />
          <NavLink
            href="/dashboard/data"
            icon={<Database className="w-4 h-4" />}
            label="Data"
          />
          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="w-4 h-4" />}
            label="Settings"
          />
        </div>
        <div className="mt-auto">
          <div className="border-t border-accent-2 -mx-4 pt-4">
            <div className="px-4 space-y-1">
              <Tooltip.Provider delayDuration={0}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className={`flex items-center w-full h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md ${
                        !expanded ? "justify-center px-2" : ""
                      }`}
                    >
                      <div
                        className={`${
                          expanded ? "w-16" : "w-12"
                        } flex items-center justify-center`}
                      >
                        <PanelLeftClose
                          className={`w-4 h-4 transition-transform duration-200 ${
                            expanded ? "" : "rotate-180"
                          }`}
                        />
                      </div>
                      {expanded && <span>Collapse</span>}
                    </button>
                  </Tooltip.Trigger>
                  {!expanded && (
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-1.5 text-sm bg-accent-1 border border-accent-2 rounded-md"
                        side="right"
                        sideOffset={8}
                      >
                        Expand
                        <Tooltip.Arrow className="fill-accent-1" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  )}
                </Tooltip.Root>
              </Tooltip.Provider>

              <Tooltip.Provider delayDuration={0}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={handleLogout}
                      className={`flex items-center w-full h-10 text-sm text-red-400 hover:text-red-300 hover:bg-accent-1 rounded-md ${
                        !expanded ? "justify-center px-2" : ""
                      }`}
                    >
                      <div
                        className={`${
                          expanded ? "w-16" : "w-12"
                        } flex items-center justify-center`}
                      >
                        <LogOut className="w-4 h-4" />
                      </div>
                      {expanded && <span>Log Out</span>}
                    </button>
                  </Tooltip.Trigger>
                  {!expanded && (
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-1.5 text-sm bg-accent-1 border border-accent-2 rounded-md"
                        side="right"
                        sideOffset={8}
                      >
                        Log Out
                        <Tooltip.Arrow className="fill-accent-1" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  )}
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
