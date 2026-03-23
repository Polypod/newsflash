import React from 'react';

export default function NewsIntelligence({ articles = [] }) {
  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No news articles available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article, index) => (
        <div
          key={article.id || index}
          className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {article.title || 'Untitled Article'}
              </p>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {article.content || article.description || 'No content available'}
              </p>
              <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
                <span>{article.source || 'Unknown source'}</span>
                <span>•</span>
                <span>
                  {article.published_at
                    ? new Date(article.published_at).toLocaleDateString()
                    : 'Unknown date'}
                </span>
                {article.category && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                      {article.category}
                    </span>
                  </>
                )}
              </div>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                >
                  Read more
                  <svg
                    className="ml-1 h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
