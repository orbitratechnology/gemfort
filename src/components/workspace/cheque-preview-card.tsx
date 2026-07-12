import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography, type ThemeColors } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import type { ChequeDirection } from '@/types';

type ChequePreviewCardProps = {
  direction: ChequeDirection;
  chequeNumber: string;
  bankName: string;
  branch?: string;
  amount: string;
  issuedBy: string;
  maturityDateLabel: string | null;
};

function formatPreviewAmount(raw: string): string {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return 'LKR —';
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 'LKR —';
  return formatCurrency(n, 'LKR');
}

function Field({
  label,
  value,
  placeholder,
  colors,
  emphasis,
}: {
  label: string;
  value: string;
  placeholder: string;
  colors: ThemeColors;
  emphasis?: boolean;
}) {
  const filled = value.trim().length > 0;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          emphasis ? styles.fieldValueLg : styles.fieldValue,
          { color: filled ? colors.onSurface : colors.outline },
        ]}
        numberOfLines={1}>
        {filled ? value : placeholder}
      </Text>
    </View>
  );
}

/**
 * Live paper-cheque preview for the Add Cheque form.
 * Updates as fields change; empty slots show muted placeholders.
 */
export function ChequePreviewCard({
  direction,
  chequeNumber,
  bankName,
  branch,
  amount,
  issuedBy,
  maturityDateLabel,
}: ChequePreviewCardProps) {
  const { colors } = useAppTheme();
  const isReceived = direction === 'received';
  const bankLine = [bankName.trim(), branch?.trim()].filter(Boolean).join(' · ');
  const amountLabel = formatPreviewAmount(amount);

  return (
    <View
      accessible
      accessibilityLabel={`Cheque preview. ${isReceived ? 'Received' : 'Given'}. ${bankLine || 'Bank pending'}. ${amountLabel}.`}>
      <View style={styles.captionRow}>
        <Text style={[styles.caption, { color: colors.textMuted }]}>Live preview</Text>
        <View
          style={[
            styles.directionPill,
            {
              backgroundColor: isReceived
                ? colors.secondaryContainer
                : colors.primaryContainer,
            },
          ]}>
          <Icon
            name={isReceived ? 'call-received' : 'call-made'}
            size={12}
            color={isReceived ? colors.onSecondaryContainer : colors.onPrimaryContainer}
          />
          <Text
            style={[
              styles.directionText,
              {
                color: isReceived ? colors.onSecondaryContainer : colors.onPrimaryContainer,
              },
            ]}>
            {isReceived ? 'Received' : 'Given'}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.cheque,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
          },
        ]}>
        <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />

        <View style={styles.chequeInner}>
          <View style={styles.topRow}>
            <View style={styles.bankBlock}>
              <View style={[styles.bankIcon, { backgroundColor: colors.primaryContainer }]}>
                <Icon name="account-balance" size={16} color={colors.onPrimaryContainer} />
              </View>
              <View style={styles.bankText}>
                <Text
                  style={[
                    styles.bankName,
                    { color: bankName.trim() ? colors.onSurface : colors.outline },
                  ]}
                  numberOfLines={1}>
                  {bankName.trim() || 'Bank name'}
                </Text>
                <Text
                  style={[styles.branch, { color: colors.textMuted }]}
                  numberOfLines={1}>
                  {branch?.trim() || 'Branch'}
                </Text>
              </View>
            </View>
            <View style={styles.numberBlock}>
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>No.</Text>
              <Text
                style={[
                  styles.chequeNo,
                  { color: chequeNumber.trim() ? colors.primary : colors.outline },
                ]}
                numberOfLines={1}>
                {chequeNumber.trim() || '————'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <Field
            label={isReceived ? 'From' : 'Pay to / issued for'}
            value={issuedBy}
            placeholder="Name on cheque"
            colors={colors}
          />

          <View style={styles.amountRow}>
            <View style={styles.amountField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount</Text>
              <Text
                style={[
                  styles.amountValue,
                  {
                    color:
                      amount.replace(/,/g, '').trim() &&
                      Number.isFinite(Number(amount.replace(/,/g, '')))
                        ? colors.onSurface
                        : colors.outline,
                  },
                ]}
                numberOfLines={1}>
                {amountLabel}
              </Text>
            </View>
            <View style={styles.maturityField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Matures</Text>
              <Text
                style={[
                  styles.fieldValue,
                  { color: maturityDateLabel ? colors.onSurface : colors.outline },
                ]}
                numberOfLines={1}>
                {maturityDateLabel ?? '—'}
              </Text>
            </View>
          </View>

          <View style={[styles.micrRow, { borderTopColor: colors.outlineVariant }]}>
            <Text style={[styles.micr, { color: colors.textMuted }]} numberOfLines={1}>
              ⑆{chequeNumber.trim() || '000000'}⑆  ⑈LKR⑈
            </Text>
            <Icon name="verified" size={14} color={colors.outline} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.stackSm,
  },
  caption: {
    ...Typography.labelMd,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  directionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  directionText: { ...Typography.labelMd, fontSize: 11, fontWeight: '600' },

  cheque: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 176,
  },
  accentBar: { height: 4 },
  chequeInner: {
    padding: Spacing.gutterMd,
    gap: Spacing.stackMd,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bankBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  bankIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankText: { flex: 1, minWidth: 0, gap: 1 },
  bankName: { ...Typography.bodyLg, fontWeight: '700' },
  branch: { ...Typography.caption },
  numberBlock: { alignItems: 'flex-end', maxWidth: '38%' },
  microLabel: { ...Typography.caption, fontSize: 10, textTransform: 'uppercase' },
  chequeNo: {
    ...Typography.bodyMd,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  divider: { height: StyleSheet.hairlineWidth },

  field: { gap: 2 },
  fieldLabel: {
    ...Typography.caption,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldValue: { ...Typography.bodyMd, fontWeight: '500' },
  fieldValueLg: { ...Typography.headlineSmMobile },

  amountRow: { flexDirection: 'row', gap: 16 },
  amountField: { flex: 1.4, gap: 2 },
  maturityField: { flex: 1, gap: 2 },
  amountValue: {
    ...Typography.headlineMdMobile,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  micrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.stackSm,
    marginTop: 2,
  },
  micr: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.2,
  },
});
