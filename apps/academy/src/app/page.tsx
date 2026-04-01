import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { getAllTracks } from '@/lib/content';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';

export default function Home() {
  const tracks = getAllTracks();

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
        <p className="text-lg text-muted-foreground mb-10">
          Interactive onboarding for the ClawdStrike runtime security enforcement
          system. Explore threat scenarios, deep-dive into guards, and build
          security policies -- all powered by the real WASM engine running in
          your browser.
        </p>

        <h3 className="text-2xl font-semibold tracking-tight mb-6">
          Learning Tracks
        </h3>

        <div className="grid gap-6 sm:grid-cols-2">
          {tracks.map((track) => (
            <Link
              key={track.slug}
              href={track.lessons[0]?.path ?? `/tracks/${track.slug}`}
              className="no-underline"
            >
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {track.lessons.length}{' '}
                      {track.lessons.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </div>
                  <CardTitle className="text-xl">{track.title}</CardTitle>
                  <CardDescription>
                    {track.lessons.map((l) => l.title).join(' / ')}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <span className="flex items-center gap-1 text-sm text-primary font-medium">
                    Start learning
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
