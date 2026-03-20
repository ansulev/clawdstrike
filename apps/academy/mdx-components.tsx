import type { MDXComponents } from 'mdx/types';
import { CodeBlock } from '@/components/mdx/code-block';
import { LessonNav } from '@/components/layout/lesson-nav';
import { GuardPlayground } from '@/components/playground/guard-playground-loader';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: CodeBlock,
    LessonNav,
    GuardPlayground,
  };
}
