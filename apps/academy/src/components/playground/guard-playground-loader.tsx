'use client';

import dynamic from 'next/dynamic';

const PromptInjectionPlayground = dynamic(
  () => import('@/components/playground/prompt-injection-playground'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse bg-muted rounded-lg my-6" />
    ),
  }
);

export function GuardPlayground() {
  return <PromptInjectionPlayground />;
}
