import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QA Test Agent - Web Interaction Testing Tool",
  description: "Automatically test and validate user flows on websites with custom test steps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <header className="bg-background border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <span className="font-bold text-xl text-foreground">QA Test Agent</span>
                </div>
                <nav className="flex items-center space-x-4">
                  <a href="/" className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium">
                    Home
                  </a>
                  <a href="/history" className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium">
                    Test History
                  </a>
                  <ThemeToggle />
                </nav>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
