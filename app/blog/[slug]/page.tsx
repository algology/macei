import { notFound } from "next/navigation";
import Link from "next/link";

export function generateStaticParams() {
  return [{ slug: "hello-world" }];
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  if (params.slug !== "hello-world") notFound();

  return (
    <main className="container mx-auto px-4 py-4 md:py-8 xl:py-10 sm:px-16 xl:px-20">
      <div className="grid grid-cols-12 gap-4">
        <div className="hidden col-span-12 lg:col-span-2 xl:block">
          <Link
            href="/blog"
            className="text-foreground-lighter hover:text-foreground flex items-center text-sm transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-chevron-left mr-2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </Link>
        </div>
        <div className="col-span-12 lg:col-span-12 xl:col-span-10">
          <div className="mb-6 lg:mb-10 max-w-5xl space-y-8">
            <div className="space-y-4">
              <Link href="/blog" className="text-brand hidden lg:inline">
                Blog
              </Link>
              <h1 className="text-2xl sm:text-4xl text-foreground">
                Hello Macy
              </h1>
              <div className="text-foreground-lighter flex space-x-3 text-sm">
                <p>26 Apr 2025</p>
                <p>•</p>
                <p>1 min read</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-12 lg:gap-16 xl:gap-8">
            <div className="col-span-12 lg:col-span-7 xl:col-span-7">
              <article className="prose prose-docs prose-headings:text-foreground">
                <h2>The Old World</h2>
                <p>
                  For decades, validating new ideas demanded manual
                  effort—surveys, focus groups, and expert interviews that cost
                  teams weeks and significant budget.
                </p>
                <h2>The transition we're going through</h2>
                <p>
                  Agentic AI flips the script by orchestrating parallel
                  validation workflows—trend analysis, user feedback
                  simulations, and rapid prototyping—all at machine speed.
                </p>
                <h2>Meet Macy</h2>
                <p>
                  Macy is your sleepless co-founder. It autonomously spins up
                  idea pipelines, gathers insights from data and users, and
                  delivers validated concepts—freeing you to focus on building
                  breakthroughs.
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
