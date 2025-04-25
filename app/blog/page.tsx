import Link from "next/link";
import Image from "next/image";

const posts = [
  {
    title: "Introducing Macy",
    slug: "hello-world",
    date: "2025-04-26",
    readingTime: "1 min read",
    summary: "Introducing Macy, the AI-powered co-founder.",
    authorName: "Alan Agon",
    authorImage: "/images/authors/alan-agon.jpg",
    thumbnail: "/images/blog/hello-world/thumb.png",
  },
];

export default function BlogIndex() {
  return (
    <main className="relative min-h-screen antialiased">
      <h1 className="sr-only">Blog</h1>
      <div className="md:container mx-auto py-4 lg:py-10 px-4 sm:px-12 xl:px-16">
        <div className="w-full">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="grid gap-4 lg:grid-cols-7 lg:gap-8 xl:gap-12 hover:bg-accent-1 transition-colors p-2 sm:p-4 rounded-xl"
            >
              <div className="relative w-full aspect-[2/1] lg:col-span-3 lg:aspect-[3/2] overflow-hidden rounded-lg border">
                <Image
                  src={post.thumbnail}
                  alt="blog thumbnail"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col space-y-2 lg:col-span-4 xl:justify-center max-w-xl">
                <div className="text-gray-500 flex space-x-2 text-sm">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span>{post.readingTime}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">{post.title}</h2>
                  <p className="text-gray-600">{post.summary}</p>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative h-6 w-6 overflow-hidden rounded-full">
                    <Image
                      src={post.authorImage}
                      alt={`${post.authorName} avatar`}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="text-sm text-gray-700">
                    {post.authorName}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
