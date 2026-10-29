import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { matchesSearch, splitSearchTerms } from '../../../lib/tableSearch'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
  /** Texto quando o filtro não encontra nada. */
  noOptionsText?: string
  /** Esconde o botão de limpar (X). */
  disableClearable?: boolean
  /** sm: 40px de altura, para barras de ação com inputs e botões compactos. */
  size?: 'md' | 'sm'
}

interface PopupPosition {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

const POPUP_MAX_HEIGHT = 288
const POPUP_GAP = 4

// Abaixo do campo quando cabe; senão, acima (como o Popper do MUI).
function popupPositionFor(element: HTMLElement): PopupPosition {
  const rect = element.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - POPUP_GAP * 2
  const above = rect.top - POPUP_GAP * 2
  if (below >= Math.min(POPUP_MAX_HEIGHT, above)) {
    return { left: rect.left, width: rect.width, top: rect.bottom + POPUP_GAP, maxHeight: Math.min(POPUP_MAX_HEIGHT, below) }
  }
  return {
    left: rect.left,
    width: rect.width,
    bottom: window.innerHeight - rect.top + POPUP_GAP,
    maxHeight: Math.min(POPUP_MAX_HEIGHT, above),
  }
}

// Autocomplete no estilo do MUI: digitar filtra as opções (sem diferenciar acentos e
// maiúsculas), ↑/↓ navegam, Enter escolhe, Esc fecha e o X limpa. A lista abre num portal
// para não ser cortada por containers com overflow (ex.: Modal).
export function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  className = '',
  'aria-label': ariaLabel,
  noOptionsText = 'Nenhuma opção',
  disableClearable = false,
  size = 'md',
}: SelectProps) {
  const generatedId = useId()
  const inputId = id ?? `${generatedId}-input`
  const listboxId = `${generatedId}-listbox`
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)

  const selected = options.find((option) => option.value === value)
  const [open, setOpen] = useState(false)
  // null = o usuário não digitou desde que abriu: mostra todas as opções e o label selecionado.
  const [query, setQuery] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState(-1)
  const [position, setPosition] = useState<PopupPosition | null>(null)

  const filtered = useMemo(() => {
    const terms = query ? splitSearchTerms(query) : []
    return terms.length === 0 ? options : options.filter((option) => matchesSearch([option.label], terms))
  }, [options, query])

  function openPopup() {
    if (disabled || open) return
    if (anchorRef.current) setPosition(popupPositionFor(anchorRef.current))
    setOpen(true)
    setQuery(null)
    setHighlighted(Math.max(0, options.findIndex((option) => option.value === value)))
  }

  function closePopup() {
    setOpen(false)
    setQuery(null)
    setHighlighted(-1)
  }

  function choose(option: SelectOption) {
    if (option.value !== value) onChange(option.value)
    closePopup()
  }

  function clear() {
    if (value !== '') onChange('')
    setQuery(null)
    inputRef.current?.focus()
  }

  function moveHighlight(step: number) {
    if (!open) {
      openPopup()
      return
    }
    if (filtered.length === 0) return
    setHighlighted((current) => (current + step + filtered.length) % filtered.length)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveHighlight(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveHighlight(-1)
        break
      case 'Enter':
        if (open && filtered[highlighted]) {
          event.preventDefault()
          choose(filtered[highlighted])
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          event.stopPropagation() // não fecha o Modal que contém o campo
          closePopup()
        }
        break
      case 'Tab':
        closePopup()
        break
    }
  }

  // Acompanha o campo quando a página (ou o Modal) rola ou a janela muda de tamanho.
  useEffect(() => {
    if (!open) return
    const update = () => anchorRef.current && setPosition(popupPositionFor(anchorRef.current))
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open || highlighted < 0) return
    listboxRef.current?.querySelector(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  const showClear = !disableClearable && !disabled && value !== '' && (selected?.label ?? '') !== ''
  const activeOption = open && highlighted >= 0 ? filtered[highlighted] : undefined

  return (
    <div ref={anchorRef} className={`relative w-full ${className}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listboxId}-${highlighted}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query ?? selected?.label ?? ''}
        onChange={(event) => {
          if (!open) openPopup()
          setQuery(event.target.value)
          setHighlighted(0)
        }}
        onClick={openPopup}
        onFocus={(event) => event.target.select()}
        onBlur={closePopup}
        onKeyDown={handleKeyDown}
        className={`${size === 'sm' ? 'h-10 text-sm' : 'h-14 text-base'} w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] pl-3 pr-16 text-[var(--text-h)] outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Limpar"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
            className="rounded-full p-1 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Fechar' : 'Abrir'}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) closePopup()
            else {
              inputRef.current?.focus()
              openPopup()
            }
          }}
          className="rounded-full p-1 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)] disabled:cursor-not-allowed"
        >
          <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open &&
        position &&
        createPortal(
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            // Mantém o foco no input: sem isso o blur fecharia a lista antes do clique na opção.
            onMouseDown={(event) => event.preventDefault()}
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-[60] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--text)]">{noOptionsText}</li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseMove={() => index !== highlighted && setHighlighted(index)}
                  onClick={() => choose(option)}
                  className={`cursor-pointer px-3 py-2 text-sm text-[var(--text-h)] ${
                    index === highlighted ? 'bg-[var(--code-bg)]' : ''
                  } ${option.value === value ? 'font-semibold text-[var(--accent)]' : ''}`}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  )
}
