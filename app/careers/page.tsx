import React from 'react';
import { Header } from "../components/Header"; // Adjust path as needed
import { Footer } from "../components/Footer"; // Adjust path as needed

export default function CareersPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-8">
          Careers at Macy
        </h1>
        <div className="prose prose-invert prose-lg max-w-none">
          <p>
            Macy is currently being developed internally by the team at <a href="https://www.11point2.io/" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">11point2</a>.
          </p>
          <p>
            While Macy doesn't have separate job openings at this time, we encourage you to explore opportunities at 11point2, the "entrepreneurship-as-a-service" company building Macy.
          </p>
          <p>
            Visit the <a href="https://www.11point2.io/careers" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">11point2 Careers page</a> for more information about joining the team behind Macy and other innovative projects.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
} 