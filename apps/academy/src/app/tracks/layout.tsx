import Link from 'next/link';
import { Menu } from 'lucide-react';
import { getAllTracks } from '@/lib/content';
import { Sidebar } from '@/components/layout/sidebar';
import { ClientShell } from '@/components/layout/client-shell';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';

export default function TracksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tracks = getAllTracks();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar trigger */}
          <Sheet>
            <SheetTrigger className="md:hidden p-2 -ml-2 rounded-md hover:bg-accent">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="pt-12">
                <Sidebar tracks={tracks} />
              </div>
            </SheetContent>
          </Sheet>
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight hover:text-primary transition-colors"
          >
            ClawdStrike Academy
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <ClientShell tracks={tracks} />

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-72 shrink-0 border-r sticky top-[53px] h-[calc(100vh-53px)] overflow-hidden">
          <Sidebar tracks={tracks} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-6 py-10 prose prose-neutral dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
