import { useAppTheme } from '@/hooks/use-app-theme';

/**
 * Series colours for Money charts. Income/expense are a two-slot categorical
 * pair, validated per mode for lightness band and colour-blind separation —
 * charts still label both series, so identity never rests on colour alone.
 * Text never wears these; it stays in ink tokens beside a coloured mark.
 */
const SERIES = {
  light: { income: '#2A7A4B', expense: '#C98A2B', overdue: '#A63D3D', dueSoon: '#D9A441' },
  dark: { income: '#4FA874', expense: '#B98230', overdue: '#C24F5A', dueSoon: '#A9922B' },
} as const;

export type MoneyChartTheme = {
  income: string;
  expense: string;
  /** Urgency states for outstanding balances; `later` is a deliberate neutral. */
  overdue: string;
  dueSoon: string;
  later: string;
  /** Recessive gridlines and baseline. */
  grid: string;
  /** Column highlight behind the selected bucket. */
  highlight: string;
  /** Unfilled tracks behind bars and meters. */
  track: string;
};

export function useMoneyChartTheme(): MoneyChartTheme {
  const { colors, isDark } = useAppTheme();
  const series = isDark ? SERIES.dark : SERIES.light;
  return {
    ...series,
    later: colors.outline,
    grid: colors.outlineVariant,
    highlight: colors.surfaceContainer,
    track: colors.surfaceContainerHigh,
  };
}

/**
 * Series colours tuned for a given surface brightness. The Money hero sits on
 * an inverted surface (ink in light mode), so it asks for the opposite mode.
 */
export function moneySeries(darkSurface: boolean) {
  const series = darkSurface ? SERIES.dark : SERIES.light;
  return { income: series.income, expense: series.expense };
}
