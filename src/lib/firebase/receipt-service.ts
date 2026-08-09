import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from '@/lib/firebase/storage-service';

/** Uploads an optional financial receipt to the owner's private Storage area. */
export async function uploadReceipt(
  ownerUid: string,
  receipt: LocalMedia | null,
): Promise<string | null> {
  if (!receipt) return null;
  return uploadLocalMedia(
    receipt,
    `receipts/${ownerUid}/${Date.now()}.${extensionForMedia(receipt)}`,
  );
}
