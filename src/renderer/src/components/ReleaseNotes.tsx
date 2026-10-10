import React from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

export function ReleaseNotes({ markdown }: { markdown: string }): React.ReactElement {
  return (
    <div className="text-sm text-app-muted space-y-4 break-words">
      <Markdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        urlTransform={(url) => (/^https?:\/\//i.test(url) ? url : '')}
        components={{
          a: ({ href, children, title }) =>
            href ? (
              <a
                href={href}
                title={title}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-highlight underline hover:opacity-80"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ src, alt, title }) =>
            src ? (
              <img src={src} alt={alt || ''} title={title} className="max-w-full h-auto rounded" />
            ) : null,
          h1: ({ children }) => (
            <h2 className="font-bold text-app-primary mt-4 mb-2">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="font-bold text-app-primary mt-4 mb-2">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="font-bold text-app-primary mt-4 mb-2">{children}</h4>
          ),
          p: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          code: ({ children }) => <code className="bg-black/30 px-1 rounded">{children}</code>
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}
