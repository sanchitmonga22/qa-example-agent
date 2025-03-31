"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <section className="text-center max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
        {title}
      </h1>
      <p className="text-gray-600">
        {description}
      </p>
      {children}
    </section>
  );
} 