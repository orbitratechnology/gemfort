import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import { submitFraudReport } from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/providers/toast-provider';
import type { FraudReportType } from '@/types';

const REPORT_TYPES: { id: FraudReportType; label: string }[] = [
  { id: 'fake_business', label: 'Fake business' },
  { id: 'scammer', label: 'Scammer' },
  { id: 'wrong_information', label: 'Wrong info' },
  { id: 'fake_gems', label: 'Fake gems' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'other', label: 'Other' },
];

type FraudReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  reporterUid: string;
  reportedBusinessId: string;
  reportedUserUid: string | null;
  businessName: string;
};

export function FraudReportSheet({
  visible,
  onClose,
  reporterUid,
  reportedBusinessId,
  reportedUserUid,
  businessName,
}: FraudReportSheetProps) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [reportType, setReportType] = useState<FraudReportType>('scammer');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (description.trim().length < 10) {
      toast.error('Please describe the issue in at least 10 characters.');
      return;
    }

    setLoading(true);
    try {
      await submitFraudReport({
        reporterUid,
        reportedBusinessId,
        reportedUserUid,
        reportType,
        description,
      });
      toast.success('Report submitted. Our team will review it.');
      setDescription('');
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not submit report.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Report a concern"
      footer={
        <Button title="Submit report" onPress={handleSubmit} loading={loading} disabled={loading} />
      }>
      <Text style={[styles.intro, { color: colors.onSurfaceVariant }]}>
        Report {businessName}. Reports are reviewed by GemFort. The business will not be notified who
        reported them.
      </Text>
      <FilterChipGroup
        label="Report type"
        options={REPORT_TYPES}
        value={reportType}
        onChange={setReportType}
      />
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Description</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="What happened? Include dates and details if you can."
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { ...Typography.bodyMd },
  field: { gap: Spacing.sm },
  label: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 0.4 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
});
