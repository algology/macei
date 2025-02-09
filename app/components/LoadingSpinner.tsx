import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = "md",
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2
          className={`${sizeClasses[size]} text-gray-400 animate-spin`}
        />
      </div>
    );
  }

  return (
    <Loader2 className={`${sizeClasses[size]} text-gray-400 animate-spin`} />
  );
}
