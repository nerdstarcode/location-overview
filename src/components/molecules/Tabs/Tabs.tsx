import clsx from 'clsx'

export interface TabItem {
  id: string
  label: string
}

export interface TabsProps {
  tabs: TabItem[]
  activeId: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--border)]" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-[var(--accent)] text-[var(--text-h)]'
                : 'border-transparent text-[var(--text)] hover:text-[var(--text-h)]',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
