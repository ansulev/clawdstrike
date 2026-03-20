import type { MDXComponents } from 'mdx/types';
import { CodeBlock } from '@/components/mdx/code-block';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: CodeBlock,
  };
}
