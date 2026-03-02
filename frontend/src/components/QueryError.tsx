type QueryErrorProps = {
  error: Error | unknown
  onRetry?: () => void
}

export function QueryError({ error, onRetry }: QueryErrorProps) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-red-500 text-2xl shrink-0">error</span>
      <div>
        <p className="font-medium text-red-200">Failed to load resources</p>
        <p className="text-sm text-red-300/80 mt-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 text-sm font-medium text-red-400 hover:text-red-300"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
