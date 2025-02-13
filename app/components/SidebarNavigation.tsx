"use client";

import Link from "next/link";
import {
  LayoutGrid,
  Database,
  Settings,
  LogOut,
  PanelLeftClose,
  ChevronRight,
  ChevronLeft,
  Network,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";

interface Props {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function SidebarNavigation({ isCollapsed, onToggle }: Props) {
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
              isCollapsed ? "justify-center px-2" : ""
            }`}
          >
            <div
              className={`${
                !isCollapsed ? "w-16" : "w-12"
              } flex items-center justify-center`}
            >
              {icon}
            </div>
            {!isCollapsed && <span>{label}</span>}
          </Link>
        </Tooltip.Trigger>
        {isCollapsed && (
          <Tooltip.Portal>
            <Tooltip.Content
              className="px-3 py-1.5 text-sm bg-accent-1 border border-accent-2 rounded-md"
              side="right"
              sideOffset={16}
              align="center"
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
      className={`fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] bg-background border-r border-accent-2 transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-52"
      }`}
    >
      <nav className="flex flex-col h-full p-4">
        <div className="space-y-1">
          <NavLink
            href="/dashboard"
            icon={<LayoutGrid className="w-4 h-4" />}
            label="Dashboard"
          />
          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="w-4 h-4" />}
            label="Settings"
          />
          <NavLink
            href="/dashboard/knowledge-graph"
            icon={<Network className="w-4 h-4" />}
            label="Knowledge Graph"
          />
        </div>
        <div className="mt-auto">
          <div className="border-t border-accent-2 -mx-4 pt-4">
            <div className="px-4 space-y-1">
              <Tooltip.Provider delayDuration={0}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={onToggle}
                      className={`flex items-center w-full h-10 text-sm text-gray-300 hover:bg-accent-1 rounded-md ${
                        isCollapsed ? "justify-center px-2" : ""
                      }`}
                    >
                      <div
                        className={`${
                          !isCollapsed ? "w-16" : "w-12"
                        } flex items-center justify-center`}
                      >
                        {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
                      </div>
                      {!isCollapsed && <span>Collapse</span>}
                    </button>
                  </Tooltip.Trigger>
                  {isCollapsed && (
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-1.5 text-sm bg-accent-1 border border-accent-2 rounded-md"
                        side="right"
                        sideOffset={16}
                        align="center"
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
                        isCollapsed ? "justify-center px-2" : ""
                      }`}
                    >
                      <div
                        className={`${
                          !isCollapsed ? "w-16" : "w-12"
                        } flex items-center justify-center`}
                      >
                        <LogOut className="w-4 h-4" />
                      </div>
                      {!isCollapsed && <span>Log Out</span>}
                    </button>
                  </Tooltip.Trigger>
                  {isCollapsed && (
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-1.5 text-sm bg-accent-1 border border-accent-2 rounded-md"
                        side="right"
                        sideOffset={16}
                        align="center"
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
