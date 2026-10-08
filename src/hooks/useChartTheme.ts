import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { useThemeVars, type ThemeVars } from './useThemeVars'
import { useColorblindMode } from './useColorblindMode'
import { useHighContrastMode } from './useHighContrastMode'
import {
  COLORBLIND_PALETTE,
  COLORBLIND_PALETTE_DARK,
  HIGH_CONTRAST_PALETTE_DARK,
  HIGH_CONTRAST_PALETTE_LIGHT,
  PALETTE,
} from '../lib/chartPalettes'
import { stateColors, type ColorMode } from '../lib/stateColors'

type AxisOption = Record<string, unknown>

export interface ChartTheme {
  theme: ThemeVars
  palette: string[]
  /** Borda dos segmentos no modo daltônico/alto contraste — espalhar em `itemStyle`. */
  paletteBorder: { borderColor?: string; borderWidth?: number }
  textStyle: { color: string }
  axisLine: { lineStyle: { color: string } }
  splitLine: { lineStyle: { color: string } }
  grid: { left: number; right: number; top: number; bottom: number; containLabel: boolean }
  /** Fundo transparente, cor de texto e grid padrão; `overrides` sobrescreve o que precisar. */
  baseOption: (overrides?: EChartsOption) => EChartsOption
  categoryAxis: (data: string[], extra?: AxisOption) => AxisOption
  valueAxis: (extra?: AxisOption) => AxisOption
  /** Modo de cor ativo (padrão, daltônico ou alto contraste) — ver lib/stateColors. */
  colorMode: ColorMode
  /** Cor de cada State (padrões centralizados em lib/stateColors; os demais seguem a paleta). */
  stateColors: (states: string[]) => string[]
}

// Alto contraste tem prioridade sobre a paleta de daltonismo quando os dois estão ativos.
function resolvePalette(isDark: boolean, colorblind: boolean, highContrast: boolean): string[] {
  if (highContrast) return isDark ? HIGH_CONTRAST_PALETTE_DARK : HIGH_CONTRAST_PALETTE_LIGHT
  if (colorblind) return isDark ? COLORBLIND_PALETTE_DARK : COLORBLIND_PALETTE
  return PALETTE
}

// Mesma prioridade de resolvePalette: alto contraste vence o daltonismo.
export function resolveColorMode(colorblind: boolean, highContrast: boolean): ColorMode {
  if (highContrast) return 'highContrast'
  return colorblind ? 'colorblind' : 'default'
}

// Preto/branco das paletas acessíveis somem contra o fundo sem borda; no alto contraste ela é mais grossa.
function resolvePaletteBorder(theme: ThemeVars, colorblind: boolean, highContrast: boolean): ChartTheme['paletteBorder'] {
  if (highContrast) return { borderColor: theme.isDark ? '#FFFFFF' : '#000000', borderWidth: 2 }
  if (colorblind) return { borderColor: theme.border, borderWidth: 1 }
  return {}
}

export function useChartTheme(): ChartTheme {
  const theme = useThemeVars()
  const colorblind = useColorblindMode()
  const highContrast = useHighContrastMode()

  return useMemo(() => {
    const textStyle = { color: theme.text }
    const axisLine = { lineStyle: { color: theme.border } }
    const splitLine = { lineStyle: { color: theme.border } }
    const grid = { left: 8, right: 16, top: 40, bottom: 8, containLabel: true }
    const palette = resolvePalette(theme.isDark, colorblind, highContrast)
    const colorMode = resolveColorMode(colorblind, highContrast)
    return {
      theme,
      palette,
      colorMode,
      stateColors: (states) => stateColors(states, palette, { mode: colorMode, isDark: theme.isDark }),
      paletteBorder: resolvePaletteBorder(theme, colorblind, highContrast),
      textStyle,
      axisLine,
      splitLine,
      grid,
      baseOption: (overrides = {}) => ({ backgroundColor: 'transparent', textStyle, grid, ...overrides }),
      categoryAxis: (data, extra = {}) => ({ type: 'category', data, axisLabel: textStyle, axisLine, ...extra }),
      valueAxis: (extra = {}) => ({ type: 'value', axisLabel: textStyle, axisLine, splitLine, ...extra }),
    }
  }, [theme, colorblind, highContrast])
}
