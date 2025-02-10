import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "/pricing" },
    { name: "Enterprise", href: "/enterprise" },
    { name: "Case Studies", href: "/cases" },
  ],
  Resources: [
    { name: "Documentation", href: "/docs" },
    { name: "API Reference", href: "/api" },
    { name: "Blog", href: "/blog" },
    { name: "Guides", href: "/guides" },
  ],
  Company: [
    { name: "About", href: "/about" },
    { name: "Careers", href: "/careers" },
    { name: "Contact", href: "/contact" },
    { name: "Legal", href: "/legal" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-accent-2 bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-bold text-sm mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <Link href="/" className="block mb-4">
              <Image
                src="/logo.svg"
                alt="MACEI Logo"
                width={90}
                height={26}
                className="antialiased"
                style={{ height: "auto" }}
              />
            </Link>
            <p className="text-sm text-gray-400 mb-4">
              Market Analysis & Context Enhancement Intelligence
            </p>
            <div className="flex gap-4">
              <Link
                href="https://twitter.com"
                className="text-gray-400 hover:text-white"
              >
                𝕏
              </Link>
              <Link
                href="https://github.com"
                className="text-gray-400 hover:text-white"
              >
                GitHub
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-accent-2">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} MACEI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
