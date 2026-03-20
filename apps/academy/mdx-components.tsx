import type { MDXComponents } from 'mdx/types';
import { CodeBlock } from '@/components/mdx/code-block';
import { LessonNav } from '@/components/layout/lesson-nav';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: CodeBlock,
    LessonNav,
  };
}
