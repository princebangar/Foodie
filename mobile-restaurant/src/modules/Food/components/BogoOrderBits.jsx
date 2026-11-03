// Web: components/BogoOrderBits.jsx — Buy 1 Get 1 bits on placed orders (badge, FREE price cell, bill row).
// Native: same texts and logic; colours as the web shows them inside `.restaurant-theme` (text-emerald-700 ->
// restaurantTheme.primaryStrong, the rest unchanged).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BadgePercent } from 'lucide-react-native';
import { Text } from '@/native/ui';
import { colors, restaurantTheme, sp } from '@/theme';
import { getOrderBogoSummary } from '@food/utils/bogo';

const formatRupees = (value) => `₹${(Number(value) || 0).toFixed(2)}`;

/** Small "Buy 1 Get 1" badge for a free order line or an order row. */
export function BogoBadge({ label = 'Buy 1 Get 1', style }) {
  return (
    <View style={[styles.badge, style]}>
      <BadgePercent size={12} color={restaurantTheme.primaryStrong} />
      <Text style={styles.badgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Price cell of a free line: the dish price struck through, then FREE (never a bare ₹0.00). */
export function BogoFreePrice({ unitValue, quantity = 1, style }) {
  const value = (Number(unitValue) || 0) * (Number(quantity) || 1);
  return (
    <View style={[styles.priceRow, style]}>
      {value > 0 ? <Text style={styles.strike}>{formatRupees(value)}</Text> : null}
      <Text style={styles.free}>FREE</Text>
    </View>
  );
}

/**
 * Bill row: "Buy 1 Get 1 offer · 2 items free (worth ₹253)". Information only, not part of the
 * total; the free items are paid for by the restaurant.
 */
export function BogoBillRow({ order, style }) {
  const { count, value } = getOrderBogoSummary(order);
  if (count <= 0) return null;
  return (
    <View style={[styles.billRow, style]}>
      <View style={styles.flex}>
        <Text style={styles.billLabel}>Buy 1 Get 1 offer</Text>
        <Text style={styles.billHint}>Free items are paid by the restaurant · not added to the total</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.billValue}>
          {count} {count === 1 ? 'item' : 'items'} free
        </Text>
        {value > 0 ? <Text style={styles.billWorth}>worth {formatRupees(value)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: sp(1),
    borderRadius: 4,
    backgroundColor: colors.emerald[100],
    paddingHorizontal: sp(1.5),
    paddingVertical: sp(0.5),
  },
  badgeText: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.25, color: restaurantTheme.primaryStrong },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: sp(1.5) },
  strike: { fontSize: 12, lineHeight: 16, color: colors.slate[400], textDecorationLine: 'line-through' },
  free: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.emerald[600] },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', gap: sp(3) },
  billLabel: { fontSize: 14, lineHeight: 20, color: colors.slate[600] },
  billHint: { fontSize: 11, lineHeight: 15, color: colors.slate[400] },
  billValue: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.emerald[600], textAlign: 'right' },
  billWorth: { fontSize: 11, lineHeight: 15, color: colors.slate[500], textAlign: 'right' },
});
