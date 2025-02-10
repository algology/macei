import { Search, Filter, Plus } from "lucide-react";

const ideas = [
  {
    name: "Defence Supply Chain Optimization",
    category: "Defence",
    impact: "High",
    status: "validated",
    signals: "23 Industry Reports, 5 Patents",
  },
  {
    name: "Mining Logistics AI",
    category: "Resources",
    impact: "High",
    status: "in review",
    signals: "12 News Articles, 3 Research Papers",
  },
  {
    name: "Healthcare Data Platform",
    category: "Public Sector",
    impact: "Medium",
    status: "ideation",
    signals: "8 Market Reports, 15 News Mentions",
  },
  {
    name: "Quantum Computing Research",
    category: "R&D",
    impact: "High",
    status: "validated",
    signals: "7 Journal Papers, 4 Industry Trends",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "validated":
      return "bg-green-500/20 text-green-400 border-green-900";
    case "in review":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-900";
    case "ideation":
      return "bg-blue-500/20 text-blue-400 border-blue-900";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-900";
  }
};

export const HeroInstanceDashboard = () => {
  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[4/3] bg-[#101618] rounded-xl border border-gray-800 overflow-hidden">
      {/* Background grid lines */}
      <div className="absolute inset-0 flex justify-between">
        {[...Array(33)].map((_, i) => (
          <div
            key={i}
            className="h-full w-px bg-gray-800/50 -900:even:hidden"
          />
        ))}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0">
        <div className="absolute bottom-0 h-32 w-full bg-gradient-to-t from-[#101618] to-transparent" />
        <div className="absolute top-0 h-32 w-full bg-gradient-to-b from-[#101618] to-transparent" />
      </div>

      {/* Main content */}
      <div className="relative h-full p-3 md:p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex gap-1 md:gap-2">
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-gray-600" />
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-gray-600" />
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-gray-600" />
            </div>
            <div className="text-gray-400 text-xs md:text-sm">
              Innovation Pipeline
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-1.5 md:p-2 rounded bg-gray-800/50 border border-gray-700 hidden sm:block">
              <Search className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
            </button>
            <button className="p-1.5 md:p-2 rounded bg-gray-800/50 border border-gray-700 hidden sm:block">
              <Filter className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
            </button>
            <button className="px-2 py-1 md:px-3 md:py-2 rounded bg-green-500/20 text-green-400 text-xs md:text-sm flex items-center gap-1 md:gap-2 border border-green-900">
              <Plus className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">New Idea</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="w-full border border-gray-800 rounded-lg overflow-hidden bg-[#101618]">
          <div className="grid grid-cols-3 md:grid-cols-5 text-xs md:text-sm text-gray-400 bg-gray-900/50">
            <div className="p-2 md:p-3 border-r border-gray-800">Name</div>
            <div className="p-2 md:p-3 border-r border-gray-800 hidden md:block">
              Category
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800 hidden md:block">
              Impact
            </div>
            <div className="p-2 md:p-3 border-r border-gray-800">Status</div>
            <div className="p-2 md:p-3">Market Signals</div>
          </div>
          {ideas.map((idea, index) => (
            <div
              key={index}
              className="grid grid-cols-3 md:grid-cols-5 text-xs md:text-sm border-t border-gray-800 hover:bg-gray-800/30"
            >
              <div className="p-2 md:p-3 border-r border-gray-800 text-gray-200">
                {idea.name}
              </div>
              <div className="p-2 md:p-3 border-r border-gray-800 text-gray-400 hidden md:block">
                {idea.category}
              </div>
              <div className="p-2 md:p-3 border-r border-gray-800 text-gray-400 hidden md:block">
                {idea.impact}
              </div>
              <div className="p-2 md:p-3 border-r border-gray-800">
                <span
                  className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs border ${getStatusColor(
                    idea.status
                  )}`}
                >
                  {idea.status}
                </span>
              </div>
              <div className="p-2 md:p-3 text-gray-400">{idea.signals}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
