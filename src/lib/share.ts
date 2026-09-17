import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { toast } from 'sonner-native';

import { safeUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
export { businessShareUrl, listingShareUrl } from '@/lib/public-links';

export type ShareLinkOptions = {
  /** Canonical URL (listing, deep link, etc.). */
  url: string;
  /** Body text. On Android this often includes the URL. */
  message?: string;
  /** Android share dialog title / iOS subject-ish title. */
  title?: string;
};

export type ShareFileOptions = {
  /** Local file URI (file://…). Never pass https://. */
  uri: string;
  mimeType?: string;
  dialogTitle?: string;
  /** iOS Uniform Type Identifier, e.g. `public.png` or `.pdf`. */
  UTI?: string;
};

export type ShareResult = 'shared' | 'dismissed' | 'unavailable';

/**
 * Share a URL / message via the system share sheet (RN Share).
 * Use this for listings and text — not expo-sharing (files only).
 */
export async function shareLink(options: ShareLinkOptions): Promise<ShareResult> {
  const { url, message, title } = options;
  const body = message?.trim()
    ? message.includes(url)
      ? message
      : `${message}\n${url}`
    : url;

  try {
    const result = await Share.share(
      process.env.EXPO_OS === 'ios'
        ? { url, message: message?.trim() || undefined, title }
        : { message: body, title },
    );

    if (result.action === Share.dismissedAction) {
      return 'dismissed';
    }
    haptics.success();
    return 'shared';
  } catch {
    haptics.error();
    toast.error(safeUserMessage('Could not open share sheet'));
    return 'unavailable';
  }
}
/**
 * Share a local file via expo-sharing (PDF, image, etc.).
 */
export async function shareFile(options: ShareFileOptions): Promise<ShareResult> {
  const { uri, mimeType, dialogTitle, UTI } = options;

  if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) {
    haptics.error();
    toast.error(safeUserMessage('Only local files can be shared this way'));
    return 'unavailable';
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    haptics.error();
    toast.error(safeUserMessage('Sharing is not available on this device'));
    return 'unavailable';
  }

  try {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle,
      UTI,
    });
    haptics.success();
    return 'shared';
  } catch {
    haptics.error();
    toast.error(safeUserMessage('Could not share file'));
    return 'unavailable';
  }
}

/** Copy a URL to the clipboard. Confirms with toast + light haptic unless `silent`. */
export async function copyLink(
  url: string,
  options?: { silent?: boolean },
): Promise<void> {
  await Clipboard.setStringAsync(url);
  if (options?.silent) return;
  haptics.light();
  toast.success(safeUserMessage('Link copied'));
}

