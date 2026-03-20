'use client';

import * as React from 'react';
import { codeToHtml } from 'shiki';
import { CopyButton } from './copy-button';

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children) && children.props) {
    return extractText((children.props as { children?: React.ReactNode }).children);
  }
  return '';
}

function extractLanguage(children: React.ReactNode): string {
  if (React.isValidElement(children) && children.props) {
    const className = (children.props as { className?: string }).className ?? '';
    const match = className.match(/language-(\w+)/);
    if (match) return match[1];
  }
  return 'text';
}

export function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const { children, ...rest } = props;
  const [highlighted, setHighlighted] = React.useState<string | null>(null);
  const code = extractText(children);
  const language = extractLanguage(children);

  React.useEffect(() => {
    let cancelled = false;
    codeToHtml(code.trim(), {
      lang: language,
      themes: {
        dark: 'github-dark',
        light: 'github-light',
      },
    }).then((html) => {
      if (!cancelled) setHighlighted(html);
    }).catch(() => {
      // Fall back to unstyled code
    });
    return () => { cancelled = true; };
  }, [code, language]);

  return (
    <div className="relative group my-4">
      {highlighted ? (
        <div dangerouslySetInnerHTML={{ __html: highlighted }} />
      ) : (
        <pre
          {...rest}
          className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm font-mono"
        >
          {children}
        </pre>
      )}
      <CopyButton text={code.trim()} />
    </div>
  );
}
