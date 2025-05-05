import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MorphingText } from "@/components/magicui/morphing-text";

// Generate static paths for known slugs at build time
export async function generateStaticParams() {
  // In a real app, fetch all slugs from your data source (CMS, Markdown, DB)
  // For now, we only have one known slug:
  const posts = [{ slug: "hello-world" }];

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Simulate fetching data for a specific blog post
// In a real app, this would fetch from a CMS, Markdown files, or database
async function getPostData(slug: string) {
  if (slug === "hello-world") {
    // Return data only for the 'hello-world' slug
    return {
      title: "Hello, Macy.",
      date: "26 Apr 2025",
      readTime: "3 min read",
      imageUrl: "/images/blog/hello-world/thumb.png",
      imageAlt: "Hello World thumbnail",
      author: {
        name: "Alan Agon and Macy", // Combined for simplicity here
        imageUrl: "/images/authors/alan-agon.jpg",
        imageAlt: "Alan Agon avatar",
      },
      // The actual content - in a real app, this would likely be Markdown/HTML fetched from source
      contentHtml: `
        <p>
          The world of starting a business is shifting beneath our feet. For
          decades, the mantra was "build it, and they will come." The hardest
          part was often the sheer technical challenge of bringing an idea to
          life – coding the app, designing the platform, wrestling with
          infrastructure. But the ground rules are changing.
        </p>
        <h2>The Commoditisation of Building</h2>
        <p>
          Software development, once a specialised art, is becoming
          increasingly accessible. AI coding assistants, powerful
          no-code/low-code platforms, and globally available talent mean that
          the act of <em>building</em> is faster and cheaper than ever. Got an
          idea for an app? An AI can help you sketch it out, write boilerplate
          code, and even design the UI. Need a
          landing page? Tools can spin one up in minutes based on a
          simple description.
        </p>
        <p>
          This democratisation is exciting. It lowers the barrier to
          entry, allowing more potential founders to translate their
          vision into something tangible. But it also introduces a new,
          potentially more dangerous bottleneck.
        </p>
        <p>
          If <em>everyone</em> can build faster, how do you ensure
          you're building the <em>right</em> thing?
        </p>
        <h2>The Founder's Gauntlet: Market Validation Before AI</h2>
        <p>
          Before the rise of sophisticated AI tools, validating a
          business idea was a brutal, often guesswork-filled process
          fraught with pitfalls:
        </p>
        <ol>
          <li>
            <strong>The Costly MVP Gamble:</strong> Founders poured weeks,
            months, and precious capital into building a Minimum Viable
            Product, often just to <em>test</em> if anyone actually wanted
            it. The MVP became less "minimum" and more "expensive bet."
          </li>
          <li>
            <strong>The Echo Chamber:</strong> Early feedback often came from
            friends, family, or enthusiastic early adopters – people prone to
            politeness or already bought into the founder's vision. This
            created false positives, confusing interest with genuine market
            demand.
          </li>
          <li>
            <strong>Analysis Paralysis:</strong> Gathering market
            research, competitor data, and potential customer interviews
            generated mountains of information. Synthesising this data
            into actionable insights was time-consuming and prone to
            human bias. Which signals mattered? Which were noise?
          </li>
          <li>
            <strong>Solution Bias Trap:</strong> It's incredibly easy to fall
            in love with your <em>solution</em>. Founders would ask leading
            questions designed to confirm their existing beliefs, rather than
            seeking to <em>invalidate</em> their assumptions and uncover the
            <em>real</em> underlying problems customers faced.
          </li>
          <li>
            <strong>The Intention-Behaviour Chasm:</strong> Surveys and
            interviews might show positive intent ("Yes, I'd use
            that!"), but translating that stated interest into actual
            user behaviour (signing up, paying, changing habits) remained
            a huge leap of faith.
          </li>
        </ol>
        <p>
          Founders weren't just battling technical hurdles; they were
          navigating a minefield of cognitive biases, ambiguous data,
          and expensive validation cycles. Building something nobody
          wanted wasn't just possible; it was tragically common – the #1
          reason startups failed.
        </p>
        <h2>The Shift: AI Isn't Just Building, It's Validating</h2>
        <p>
          This is where the <em>real</em> AI revolution for
          entrepreneurs lies. Yes, AI helps build faster. But more
          importantly, AI can now tackle the "heavy lifting" of market
          validation <em>before</em> you commit significant resources.
        </p>
        <p>Imagine having a co-founder who:</p>
        <ul>
          <li>
            <strong>Never sleeps:</strong> Continuously scans market
            trends, competitor movements, and customer sentiment 24/7.
          </li>
          <li>
            <strong>Is brutally objective:</strong> Analyses data
            without emotional attachment to a specific solution.
          </li>
          <li>
            <strong>Synthesises at scale:</strong> Processes vast
            amounts of information – market reports, user feedback,
            academic papers, news articles – identifying patterns and
            opportunities invisible to the human eye.
          </li>
          <li>
            <strong>Simulates scenarios:</strong> Helps model potential
            market reception and identify key risks <em>before</em> you
            build.
          </li>
          <li>
            <strong>Speaks the customer's language:</strong> Helps craft
            unbiased questions and analyse interview transcripts for
            deeper, unstated needs.
          </li>
        </ul>
        <p>
          This isn't science fiction. This is the potential AI brings to the
          table <em>today</em>. It transforms validation from a
          high-stakes gamble into a data-driven discovery process.
        </p>
        <h2>Meet Macy: Your AI Co-Founder for Market Validation</h2>
        <p>
          We built Macy precisely to address this new reality. While
          other tools focus on accelerating the <em>build</em>, Macy is
          designed to be your AI co-founder focused squarely on
          <strong>
            de-risking your idea through rigorous, intelligent
            validation.
          </strong>
        </p>
        <p>Macy helps you:</p>
        <ul>
          <li>
            <strong>Discover, Not Just Validate:</strong> Go beyond
            surface-level problems. Macy analyses market signals and
            helps you understand the <em>real</em> pain points and
            motivations of your target audience.
          </li>
          <li>
            <strong>Cut Through the Noise:</strong> Synthesise market
            research, competitor analysis, and potential customer data
            into clear, actionable insights.
          </li>
          <li>
            <strong>Challenge Your Assumptions:</strong> Identify
            potential biases in your thinking and test critical
            hypotheses against real-world data.
          </li>
          <li>
            <strong>Prioritise Effectively:</strong> Understand which
            market needs are most urgent, painful, and growing.
          </li>
          <li>
            <strong>Move Faster, with Confidence:</strong> Get
            data-backed validation signals <em>before</em> you invest
            heavily in development, saving time, money, and heartache.
          </li>
        </ul>
        <p>
          The barrier to <em>building</em> is falling. The new
          competitive advantage lies in
          <strong>knowing *what* to build.</strong> It's about moving
          from "build it and hope they come" to "understand them,
          validate the need, then build with confidence."
        </p>
        <p>
          Macy is your partner in that journey – the AI co-founder that
          helps you navigate the uncertainty, avoid the pitfalls, and
          dramatically increase your odds of building something the
          market truly needs.
        </p>
        <p>Ready to stop gambling and start validating?</p>
      `,
    };
  }
  // Return null or throw an error if the slug doesn't match
  return null;
}

// Changed function signature to accept params as a Promise and be async
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Await params before accessing slug
  const slug = (await params).slug;

  // Fetch post data based on slug
  const postData = await getPostData(slug);

  // If postData is null (slug not found), call notFound()
  if (!postData) {
    notFound();
  }

  // Render the post using the fetched data
  return (
    <>
      {/* Post Header */}
      <div className="mb-6 lg:mb-10 max-w-5xl space-y-8">
        <div className="space-y-4">
          <Link
            href="/blog"
            className="text-brand hidden lg:inline text-green-500"
          >
            Blog
          </Link>
          <h1 className="text-2xl sm:text-4xl text-foreground">
            {postData.title}
          </h1>
          <div className="text-foreground-lighter flex space-x-3 text-sm">
            <p>{postData.date}</p>
            <p>•</p>
            <p>{postData.readTime}</p>
          </div>
        </div>
      </div>

      {/* Post Image / Morphing Text based on slug */}
      <div className="mb-8 max-w-5xl mx-auto bg-accent-1 rounded-lg overflow-hidden p-8 flex items-center justify-center min-h-[10rem]">
        {slug === "hello-world" ? (
          // Render MorphingText for the hello-world post
          <MorphingText
            texts={["Stop guessing.", "Start knowing.", "Hello, Macy."]}
            className="w-full text-3xl sm:text-5xl text-center font-bold text-gray-200 p-4 leading-relaxed whitespace-pre-line" // Added whitespace-pre-line to render \n
          />
        ) : (
          // Render standard image for other posts
          <Image
            src={postData.imageUrl}
            alt={postData.imageAlt}
            width={1200}
            height={675} // Approximate 16:9 aspect ratio
            className="object-cover w-full h-full"
          />
        )}
      </div>

      {/* Author Info */}
      <div className="flex items-center space-x-3 mt-4 mb-8 text-sm text-foreground-lighter justify-start max-w-5xl mx-auto">
        <div className="h-10 w-10 rounded-full overflow-hidden">
          <Image
            src={postData.author.imageUrl}
            alt={postData.author.imageAlt}
            width={40}
            height={40}
            className="object-cover"
          />
        </div>
        <span>Written by {postData.author.name}</span>
      </div>

      {/* Post Content */}
      <div className="grid grid-cols-12 lg:gap-16 xl:gap-8">
        <div className="col-span-12">
          <article
            className="prose prose-docs prose-headings:text-foreground prose-invert max-w-none"
            // Render the fetched HTML content
            // NOTE: In a real app using Markdown, you'd typically parse Markdown to HTML here
            // using libraries like 'remark' and 'remark-html', then use dangerouslySetInnerHTML.
            // Ensure proper sanitisation if the source HTML isn't fully trusted.
            dangerouslySetInnerHTML={{ __html: postData.contentHtml }}
          />
        </div>
      </div>
    </>
  );
}
