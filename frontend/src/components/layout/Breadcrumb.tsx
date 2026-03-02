import { Link } from '@tanstack/react-router'

type BreadcrumbItem = {
  label: string
  href?: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav className="flex items-center gap-1 text-sm text-slate-400 mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && (
              <span className="material-symbols-outlined text-[16px] text-slate-600">
                chevron_right
              </span>
            )}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="hover:text-slate-100 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-100 font-medium' : ''}>
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
