import { Auth } from "../components/Auth";
import { Background } from "../components/Background";

export default function LoginPage() {
  return (
    <>
      <Background />
      <div className="min-h-screen flex items-center justify-center relative p-4">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/80 via-transparent to-background/80" />
        <div className="relative z-10 w-full max-w-3xl">
          <Auth />
        </div>
      </div>
    </>
  );
}
