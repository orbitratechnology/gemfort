import { Children, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/design-tokens';

type ProductGridProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  /** Edge inset so tiles sit near the viewport edge (ecommerce-style). */
  edgeInset?: number;
};

/**
 * Full-width 2-column masonry product grid (column-flow).
 * Items stack top-to-bottom in each column so variable heights don't leave
 * row gaps. Children should be width:100% tiles (ListingCard, BusinessCard, GemCard).
 */
export function ProductGrid({
  children,
  style,
  gap = Spacing.stackSm,
  edgeInset = Spacing.stackSm,
}: ProductGridProps) {
  const [left, right] = useMemo(() => {
    const items = Children.toArray(children).filter(Boolean);
    const cols: [ReactNode[], ReactNode[]] = [[], []];
    items.forEach((child, i) => {
      cols[i % 2].push(child);
    });
    return cols;
  }, [children]);

  return (
    <View style={[styles.grid, { gap, paddingHorizontal: edgeInset }, style]}>
      <View style={[styles.column, { gap }]}>{left}</View>
      <View style={[styles.column, { gap }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
});
