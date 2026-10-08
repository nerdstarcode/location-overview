import { Chip } from '../../atoms/Chip/Chip'

export interface TagsCellProps {
  tags: string[]
}

// Exibe as tags como badges (somente leitura).
export function TagsCell({ tags }: TagsCellProps) {
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-1 py-0.5">
      {tags.length === 0 ? (
        <span className="text-[var(--text)]">—</span>
      ) : (
        tags.map((tag) => <Chip key={tag} label={tag} />)
      )}
    </div>
  )
}
