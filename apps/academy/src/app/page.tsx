import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-bold tracking-tight">
          ClawdStrike Academy
        </h1>
        <ThemeToggle />
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-4xl font-bold tracking-tight mb-4">
          Learn Runtime Security
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Interactive onboarding for the ClawdStrike runtime security enforcement
          system. Explore threat scenarios, deep-dive into guards, and build
          security policies -- all powered by the real WASM engine running in
          your browser.
        </p>
        <Link
          href="/test-mdx"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          View MDX Test Page
        </Link>
      </main>
    </div>
  );
}
