import type { MDXComponents } from 'mdx/types';
import { CodeBlock } from '@/components/mdx/code-block';
import { LessonNav } from '@/components/layout/lesson-nav';
import { GuardPlayground } from '@/components/playground/guard-playground-loader';
import { AnnotatedSource } from '@/components/mdx/annotated-source';
import { LessonCompleteButton } from '@/components/mdx/lesson-complete-button';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: CodeBlock,
    LessonNav,
    GuardPlayground,
    AnnotatedSource,
    LessonCompleteButton,
  };
}
