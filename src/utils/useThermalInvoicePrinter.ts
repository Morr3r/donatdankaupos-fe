import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import type { Transaction } from '../types/domain';
import { printThermalInvoice } from './thermal-printer';

export interface ThermalPrintFeedback {
  message: string;
  tone: 'success' | 'danger';
}

export function useThermalInvoicePrinter(transaction: Transaction | undefined) {
  const printInProgressRef = useRef(false);
  const [printingInvoice, setPrintingInvoice] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<ThermalPrintFeedback | null>(null);

  const printInvoice = useCallback(async () => {
    if (printInProgressRef.current) return;
    if (!transaction) {
      setPrintFeedback({ message: 'Transaksi tidak ditemukan.', tone: 'danger' });
      return;
    }

    printInProgressRef.current = true;
    setPrintingInvoice(true);
    setPrintFeedback(null);
    try {
      const printer = await printThermalInvoice(transaction);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPrintFeedback({
        message: `Invoice tercetak 2 salinan berurutan (KONSUMEN dan TOKO) melalui ${printer.name}. Sobek pada penanda antar-salinan.`,
        tone: 'success',
      });
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setPrintFeedback({
        message: error instanceof Error ? error.message : 'Invoice belum dapat dicetak. Silakan coba lagi.',
        tone: 'danger',
      });
    } finally {
      printInProgressRef.current = false;
      setPrintingInvoice(false);
    }
  }, [transaction]);

  return { printFeedback, printInvoice, printingInvoice };
}
