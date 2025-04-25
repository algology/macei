import React from 'react';
import { Inter } from 'next/font/google';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

const inter = Inter({ subsets: ['latin'], weight: ['400','600','700'] });

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className={inter.className}>
        <div className="container mx-auto max-w-7xl px-4">
          {children}
        </div>
      </div>
      <Footer />
    </>
  );
}
