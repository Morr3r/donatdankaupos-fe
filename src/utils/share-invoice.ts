import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type InvoiceShareResult = 'shared' | 'downloaded' | 'unavailable';

export async function shareInvoiceImage(
  imageUri: string,
  receiptNo: string,
): Promise<InvoiceShareResult> {
  const safeReceiptNo = receiptNo.replace(/[^a-zA-Z0-9_-]/g, '-');
  const fileName = `invoice-${safeReceiptNo}.jpg`;

  if (Platform.OS === 'web') {
    const response = await fetch(imageUri);
    const imageBlob = await response.blob();
    const imageFile = new File([imageBlob], fileName, { type: 'image/jpeg' });
    const webNavigator = window.navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; text: string; title: string }) => Promise<void>;
    };
    const shareData = {
      files: [imageFile],
      text: `Invoice transaksi ${receiptNo}`,
      title: `Invoice ${receiptNo}`,
    };

    if (webNavigator.share && (!webNavigator.canShare || webNavigator.canShare(shareData))) {
      await webNavigator.share(shareData);
      return 'shared';
    }

    const anchor = document.createElement('a');
    anchor.download = fileName;
    anchor.href = imageUri;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return 'downloaded';
  }

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  await Sharing.shareAsync(imageUri, {
    dialogTitle: `Bagikan invoice ${receiptNo}`,
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
  });
  return 'shared';
}
