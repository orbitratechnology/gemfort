import { MediaField } from '@/components/ui/media-field';
import type { LocalMedia } from '@/lib/firebase/storage-service';

type ReceiptFieldProps = {
  value: LocalMedia | null;
  onChange: (media: LocalMedia | null) => void;
  label?: string;
  variant?: 'card' | 'row';
};

/** Optional receipt attachment shared by all financial forms. */
export function ReceiptField({
  value,
  onChange,
  label = 'Receipt (optional)',
  variant = 'row',
}: ReceiptFieldProps) {
  return (
    <MediaField
      label={label}
      hint="Attach a photo or PDF. It is saved with this record."
      value={value}
      onChange={onChange}
      allows="imagesOrDocuments"
      emptyTitle="Add receipt"
      emptySubtitle="Photo or PDF"
      variant={variant}
      sourcePickerTitle="Add receipt"
    />
  );
}
