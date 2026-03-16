'use client';

import { useState, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import type { PluggableList } from 'unified';
import type { MarkdownContentProps } from './types';

// 动态导入 react-markdown 及其插件，减少首屏加载 ~200KB
const ReactMarkdown = dynamic(
  () => import('react-markdown').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="text-sm text-gray-400">Loading...</div> }
);

// 插件动态导入
const remarkPluginsPromise = Promise.all([
  import('remark-gfm').then((m) => m.default),
]);

// rehype 插件（不使用 rehype-highlight，改用 react-syntax-highlighter）
const rehypePluginsPromise = Promise.all([
  import('rehype-raw').then((m) => m.default),
  import('rehype-sanitize').then((m) => m.default),
]);

// 动态导入 syntax highlighter
let SyntaxHighlighter: any = null;
let vscDarkPlus: any = null;

async function loadSyntaxHighlighter() {
  if (!SyntaxHighlighter) {
    const [mod, styleMod] = await Promise.all([
      import('react-syntax-highlighter').then((m) => m.Prism),
      import('react-syntax-highlighter/dist/esm/styles/prism').then((m) => m.vscDarkPlus),
    ]);
    SyntaxHighlighter = mod;
    vscDarkPlus = styleMod;
  }
  return { SyntaxHighlighter, vscDarkPlus };
}

// 插件缓存，避免重复加载
let cachedRemarkPlugins: PluggableList | null = null;
let cachedRehypePlugins: PluggableList | null = null;

async function loadPlugins() {
  if (!cachedRemarkPlugins) {
    cachedRemarkPlugins = await remarkPluginsPromise as PluggableList;
  }
  if (!cachedRehypePlugins) {
    cachedRehypePlugins = await rehypePluginsPromise as PluggableList;
  }
  return { remarkPlugins: cachedRemarkPlugins, rehypePlugins: cachedRehypePlugins };
}

function MarkdownContent({ content }: MarkdownContentProps) {
  const [plugins, setPlugins] = useState<{ remark: PluggableList; rehype: PluggableList } | null>(null);
  const [highlighter, setHighlighter] = useState<{ SyntaxHighlighter: any; style: any } | null>(null);

  useEffect(() => {
    Promise.all([
      loadPlugins(),
      loadSyntaxHighlighter(),
    ]).then(([{ remarkPlugins, rehypePlugins }, { SyntaxHighlighter, vscDarkPlus }]) => {
      setPlugins({ remark: remarkPlugins, rehype: rehypePlugins });
      setHighlighter({ SyntaxHighlighter, style: vscDarkPlus });
    });
  }, []);

  if (!plugins || !highlighter) {
    return <span>{content}</span>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={plugins.remark}
      rehypePlugins={plugins.rehype}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');

          // 非代码块或无语言标识的 inline code
          if (inline || !match) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          // 使用 SyntaxHighlighter 渲染代码块
          return (
            <highlighter.SyntaxHighlighter
              style={highlighter.style}
              language={match[1]}
              PreTag="div"
              className="rounded-lg !my-0 !bg-[#1e1e1e] border border-zinc-800"
              customStyle={{
                margin: 0,
                padding: '1em',
                background: '#1e1e1e',
                borderRadius: '0.5rem',
              }}
              {...props}
            >
              {codeString}
            </highlighter.SyntaxHighlighter>
          );
        },
        // 表格样式增强
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-slate-300 dark:border-slate-600">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-slate-100 dark:bg-slate-800">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-slate-600 dark:text-slate-300">
              {children}
          </td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default memo(MarkdownContent);
