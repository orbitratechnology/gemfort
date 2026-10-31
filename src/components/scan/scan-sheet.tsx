import { router } from 'expo-router';

import { ScanTile, ScanToAddRow } from '@/components/scan/scan-to-add-row';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAppTheme } from '@/hooks/use-app-theme';

type ScanSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** Every camera entry point in one grid: scan a document to add it, or a certificate code to verify it. */
export function ScanSheet({ visible, onClose }: ScanSheetProps) {
  const { colors } = useAppTheme();

  const scanCertificate = () => {
    onClose();
    router.push('/scan-certificate');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Scan" fitToContents>
      <ScanToAddRow
        onBeforeCapture={onClose}
        trailing={
          <ScanTile
            label="Certificate"
            hint="QR or barcode → Lab report"
            icon="qr-code-scanner"
            accent={colors.primary}
            onPress={scanCertificate}
          />
        }
      />
    </BottomSheet>
  );
}
