import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Tier Configuration
// ---------------------------------------------------------------------------

type Tier = 'green' | 'yellow' | 'orange' | 'red';

const TIER_COLORS: Record<Tier, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  yellow:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  orange:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const TIER_LABELS: Record<Tier, string> = {
  green: 'Beginner',
  yellow: 'Intermediate',
  orange: 'Advanced',
  red: 'Expert',
};

const TIER_SECTIONS: { tier: Tier; title: string }[] = [
  { tier: 'green', title: 'Green Tier: Pattern Matching' },
  { tier: 'yellow', title: 'Yellow Tier: Regex & Structural Analysis' },
  { tier: 'orange', title: 'Orange Tier: ML & Heuristic Detection' },
  { tier: 'red', title: 'Red Tier: Advanced & Composite' },
];

// ---------------------------------------------------------------------------
// Guard Cards
// ---------------------------------------------------------------------------

interface GuardCard {
  slug: string;
  name: string;
  tier: Tier;
  description: string;
  prereqs: string;
}

const GUARD_CARDS: GuardCard[] = [
  // Green tier
  {
    slug: '01-forbidden-path',
    name: 'Forbidden Path',
    tier: 'green',
    description:
      'Blocks access to sensitive filesystem paths like SSH keys and credentials',
    prereqs: 'None',
  },
  {
    slug: '02-path-allowlist',
    name: 'Path Allowlist',
    tier: 'green',
    description:
      'Deny-by-default filesystem access -- only explicitly allowed paths pass',
    prereqs: 'None',
  },
  {
    slug: '03-egress-allowlist',
    name: 'Egress Allowlist',
    tier: 'green',
    description:
      'Controls which domains an agent can make network requests to',
    prereqs: 'None',
  },
  // Yellow tier
  {
    slug: '04-secret-leak',
    name: 'Secret Leak',
    tier: 'yellow',
    description:
      'Detects API keys, tokens, and credentials in file writes using regex patterns',
    prereqs: 'Regex basics',
  },
  {
    slug: '05-shell-command',
    name: 'Shell Command',
    tier: 'yellow',
    description:
      'Blocks dangerous shell commands like rm -rf, reverse shells, and data exfiltration',
    prereqs: 'Shell basics',
  },
  {
    slug: '06-patch-integrity',
    name: 'Patch Integrity',
    tier: 'yellow',
    description:
      'Analyzes unified diffs for forbidden patterns and suspicious modification ratios',
    prereqs: 'Unified diff format',
  },
  {
    slug: '07-mcp-tool',
    name: 'MCP Tool',
    tier: 'yellow',
    description:
      'Restricts which MCP tools an agent can invoke and enforces argument size limits',
    prereqs: 'MCP protocol basics',
  },
  // Orange tier
  {
    slug: '08-prompt-injection',
    name: 'Prompt Injection',
    tier: 'orange',
    description:
      'Detects attempts to override AI agent instructions through crafted text inputs',
    prereqs: 'LLM prompting',
  },
  {
    slug: '09-jailbreak',
    name: 'Jailbreak',
    tier: 'orange',
    description:
      '4-layer detection: heuristic, statistical, ML model, and optional LLM judge',
    prereqs: 'Prompt injection guard',
  },
  {
    slug: '10-computer-use',
    name: 'Computer Use',
    tier: 'orange',
    description:
      'Controls CUA actions for remote desktop sessions with three enforcement modes',
    prereqs: 'CUA concepts',
  },
  // Red tier
  {
    slug: '11-spider-sense',
    name: 'Spider Sense',
    tier: 'red',
    description:
      'Hierarchical threat screening using embedding-based cosine similarity',
    prereqs: 'Embeddings, cosine similarity',
  },
  {
    slug: '12-remote-desktop',
    name: 'Remote Desktop Side Channel',
    tier: 'red',
    description:
      'Controls 6 side channels: clipboard, file transfer, audio, drive mapping, printing, session share',
    prereqs: 'Computer use guard',
  },
  {
    slug: '13-input-injection',
    name: 'Input Injection Capability',
    tier: 'red',
    description:
      'Restricts input injection capabilities (keyboard, mouse, touch) in CUA environments',
    prereqs: 'Computer use guard',
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function GuardGalleryPage() {
  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Guard Gallery</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Deep-dive into each of ClawdStrike&apos;s 13 built-in security guards
        </p>
        <p className="text-sm text-muted-foreground mt-4 max-w-2xl">
          Guards are organized by complexity. Start with green tier for
          pattern-matching guards, work up to red tier for ML-based detection.
        </p>
      </div>

      {/* Tier sections */}
      {TIER_SECTIONS.map(({ tier, title }) => {
        const cards = GUARD_CARDS.filter((c) => c.tier === tier);
        if (cards.length === 0) return null;

        return (
          <section key={tier} className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight border-b pb-2">
              {title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <Link
                  key={card.slug}
                  href={`/tracks/guard-gallery/${card.slug}`}
                  className="group block"
                >
                  <Card className="h-full transition-colors group-hover:border-primary/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          {card.name}
                        </CardTitle>
                        <Badge
                          className={TIER_COLORS[card.tier]}
                          variant="outline"
                        >
                          {TIER_LABELS[card.tier]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {card.description}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Prerequisites:
                        </span>{' '}
                        {card.prereqs}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
