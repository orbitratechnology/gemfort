import { Children, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/design-tokens';

type ProductGridProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
};

/**
 * Full-width 2-column ecommerce product grid.
 * Children should be flex:1 tiles (ListingCard, BusinessCard, GemCard).
 */
export function ProductGrid({ children, style, gap = Spacing.stackMd }: ProductGridProps) {
  const rows = useMemo(() => {
    const items = Children.toArray(children).filter(Boolean);
    const pairs: ReactNode[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      pairs.push(items.slice(i, i + 2));
    }
    return pairs;
  }, [children]);

  return (
    <View style={[styles.grid, { gap }, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap }]}>
          {row.map((child, colIndex) => (
            <View key={colIndex} style={styles.cell}>
              {child}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
