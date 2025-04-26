import React from 'react';
import { Header } from "../components/Header"; // Adjust path as needed
import { Footer } from "../components/Footer"; // Adjust path as needed

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-8">
          About Macy
        </h1>
        <div className="prose prose-invert prose-lg max-w-none">
          <p>
            Macy is a tool designed to help entrepreneurs and innovators rigorously validate their ideas before committing significant resources.
          </p>
          <p>
            It was born out of <a href="https://www.11point2.io/" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">11point2</a>, an "entrepreneurship-as-a-service" company in Adelaide, Australia that specializes in applying founder mindsets to solve complex challenges, particularly in asset-intensive industries.
          </p>
          <p>
            The core concept stems from 11point2's focus on uncovering and rapidly validating unique solutions – embodying their name, which represents Earth's escape velocity (11.2 km/s) and symbolizes the successful launch of well-prepared, worthwhile ideas. Macy aims to bring that same spirit of rigorous validation to a wider audience of creators and builders.
          </p>
          <p>
            Macy serves as an AI co-founder, helping users de-risk their ventures by focusing on market needs and data-driven insights, much like the "Idea Validators" who work within 11point2 to test and refine concepts.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
} 