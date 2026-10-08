import { normalizeKey } from './text'

// Cores padrão dos States de Work Item, usadas em todo o app (gráficos e badges).
// Para mudar a cor de um State ou incluir um novo, edite só STATE_TONES.

type Tone = 'gray' | 'blue' | 'darkBlue' | 'lightBlue' | 'orange' | 'red' | 'green' | 'yellow'

/** State (sem diferenciar maiúsculas/espaços) → tom. States fora da lista seguem a paleta do gráfico. */
const STATE_TONES: Record<string, Tone> = {
  new: 'gray',
  active: 'blue',
  'on hold': 'yellow',
  'testing qa': 'orange',
  fail: 'red',
  'mr prod': 'darkBlue',
  'testing prod': 'lightBlue',
  closed: 'green',
}

/** Ordem do fluxo, para gráficos/listas por State; states fora da lista vão para o fim, em ordem alfabética. */
export const STATE_ORDER = [
  'New',
  'Active',
  'On Hold',
  'Testing QA',
  'Fail',
  'MR Prod',
  'Testing Prod',
  'Resolved',
  'Closed',
  'Done',
  'Canceled',
  'Removed',
]

export type ColorMode = 'default' | 'colorblind' | 'highContrast'

type ToneSet = Record<Tone, string>

// Cada modo/tema tem sua versão dos tons, mantendo o mesmo significado (azul escuro < azul < azul claro).
const TONES: Record<ColorMode, { light: ToneSet; dark: ToneSet }> = {
  // Paleta da marca (chartPalettes.PALETTE).
  default: {
    light: {
      gray: '#8C959F',
      blue: '#0072BC',
      darkBlue: '#002F5C',
      lightBlue: '#7CC7FF',
      orange: '#FF7A00',
      red: '#E42600',
      green: '#00CB5D',
      yellow: '#FFC400',
    },
    dark: {
      gray: '#8C959F',
      blue: '#1E88E5',
      darkBlue: '#1A4F8B',
      lightBlue: '#9AD6FF',
      orange: '#FF7A00',
      red: '#FF4D2E',
      green: '#00CB5D',
      yellow: '#FFC400',
    },
  },
  // Okabe-Ito: laranja × vermelhão × verde-azulado seguem distinguíveis para daltônicos.
  colorblind: {
    light: {
      gray: '#999999',
      blue: '#0072B2',
      darkBlue: '#003D5C',
      lightBlue: '#56B4E9',
      orange: '#E69F00',
      red: '#D55E00',
      green: '#009E73',
      yellow: '#F0E442',
    },
    dark: {
      gray: '#BFBFBF',
      blue: '#3D9BE0',
      darkBlue: '#2F6FA8',
      lightBlue: '#9CD3F5',
      orange: '#E69F00',
      red: '#FF7A3D',
      green: '#00BE8A',
      yellow: '#F0E442',
    },
  },
  // Alto contraste: tons escuros sobre branco e claros sobre preto.
  highContrast: {
    light: {
      gray: '#555555',
      blue: '#0050A0',
      darkBlue: '#001F4D',
      lightBlue: '#2E7FC7',
      orange: '#A34700',
      red: '#9E0000',
      green: '#1B5E00',
      yellow: '#8A5300',
    },
    dark: {
      gray: '#BFBFBF',
      blue: '#4DA3FF',
      darkBlue: '#7C9CFF',
      lightBlue: '#A8E1FF',
      orange: '#FFA64D',
      red: '#FF6B6B',
      green: '#7CFF6B',
      yellow: '#FFD84D',
    },
  },
}

export interface StateColorOptions {
  mode: ColorMode
  isDark: boolean
}

/** Cor padrão do State, ou undefined quando ele não tem cor definida. */
export function stateColor(state: string, { mode, isDark }: StateColorOptions): string | undefined {
  const tone = STATE_TONES[normalizeKey(state)]
  if (!tone) return undefined
  const set = TONES[mode]
  return (isDark ? set.dark : set.light)[tone]
}

/**
 * Cor de cada State de `states`: a padrão quando existe; os demais giram pela `palette`,
 * pulando as cores já usadas pelos States padrão para não se confundirem com eles.
 */
export function stateColors(states: string[], palette: string[], options: StateColorOptions): string[] {
  const fixed = states.map((state) => stateColor(state, options))
  const used = new Set(fixed.filter(Boolean).map((color) => color!.toUpperCase()))
  const rotation = palette.filter((color) => !used.has(color.toUpperCase()))
  const fallback = rotation.length > 0 ? rotation : palette
  let next = 0
  return fixed.map((color) => color ?? fallback[next++ % fallback.length])
}

/** Ordena por STATE_ORDER; states fora da lista vão para o fim, em ordem alfabética. */
export function stateRank(state: string): number {
  const index = STATE_ORDER.findIndex((s) => normalizeKey(s) === normalizeKey(state))
  return index >= 0 ? index : STATE_ORDER.length
}
