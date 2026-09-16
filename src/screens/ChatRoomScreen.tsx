import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Check, CheckCheck, ChevronLeft, ImageIcon, Info, MessageSquare, ReceiptText } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChatAvatar,
  Composer,
  DateSeparator,
  EmptyChatState,
  MessageActionSheet,
  MessageBubble,
  TypingIndicator,
  formatDayLabel,
  isSameCluster,
  shouldStartNewDay,
} from '../components/chat';
import { ForwardPicker, TransactionPicker } from '../components/chat-modals';
import { AppBackground, FormModal, ScalePressable } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { startChatPolling, useChatStore } from '../store/chatStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ChatMessage, ChatTransactionSummary, Transaction } from '../types/domain';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ChatRoom'>;

/** Edits stay open for the same 15 minutes the API allows, so the menu never offers a dead action. */
const EDIT_WINDOW_MS = 15 * 60_000;
const MAX_IMAGE_BASE64 = 690_000;
const MAX_AUDIO_BASE64 = 2_900_000;
const MAX_RECORDING_MS = 120_000;

const roleLabels = {
  cashier: 'Kasir',
  staff: 'Staf',
  manager: 'Manajer',
  owner: 'Owner',
} as const;

const lastOnlineClock = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Jakarta',
});

const lastOnlineDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Jakarta',
});

function jakartaDayKey(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

function formatLastOnline(value?: string | null): string {
  if (!value) return 'Waktu terakhir online belum tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu terakhir online belum tersedia';
  const today = jakartaDayKey(new Date());
  const yesterday = jakartaDayKey(new Date(Date.now() - 86_400_000));
  const key = jakartaDayKey(date);
  if (key === today) return `Terakhir online pukul ${lastOnlineClock.format(date)}`;
  if (key === yesterday) return `Terakhir online kemarin pukul ${lastOnlineClock.format(date)}`;
  return `Terakhir online ${lastOnlineDate.format(date)}`;
}

async function audioUriToBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return new File(uri).base64();
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Voice note tidak dapat dibaca.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

function transactionSummary(transaction: Transaction): ChatTransactionSummary {
  return {
    id: transaction.id,
    receiptNo: transaction.receiptNo,
    createdAt: transaction.createdAt,
    cashierName: transaction.cashierName,
    customerName: transaction.customerName,
    itemCount: transaction.itemCount,
    pieceCount: transaction.pieceCount,
    total: transaction.total,
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    orderType: transaction.orderType,
  };
}

interface Row {
  key: string;
  message: ChatMessage;
  showDay: boolean;
  showSender: boolean;
  isClusterEnd: boolean;
}

export function ChatRoomScreen() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Row>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingLimitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAt = useRef<number | null>(null);
  const recordingDurationRef = useRef(0);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => undefined);
  const recordingBusy = useRef(false);
  const isLeavingRoom = useRef(false);

  const conversationId = params.conversationId;
  const currentUser = useSessionStore((state) => state.user);
  const conversation = useChatStore((state) =>
    state.conversations.find((item) => item.id === conversationId),
  );
  const conversations = useChatStore((state) => state.conversations);
  const messages = useChatStore((state) => state.messagesByConversation[conversationId]);
  const hasMore = useChatStore((state) => state.hasMoreByConversation[conversationId] ?? false);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);

  const openConversation = useChatStore((state) => state.openConversation);
  const closeConversation = useChatStore((state) => state.closeConversation);
  const loadOlder = useChatStore((state) => state.loadOlder);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const retryMessage = useChatStore((state) => state.retryMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const forwardMessage = useChatStore((state) => state.forwardMessage);
  const reactToMessage = useChatStore((state) => state.reactToMessage);
  const markRead = useChatStore((state) => state.markRead);
  const notifyTyping = useChatStore((state) => state.notifyTyping);

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [transactionPickerVisible, setTransactionPickerVisible] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const [readInfoTarget, setReadInfoTarget] = useState<ChatMessage | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardVisibleRef = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Tighten the poll to room cadence while this screen owns the foreground, and hand it
  // back to list cadence on the way out.
  useFocusEffect(
    useCallback(() => {
      void openConversation(conversationId);
      startChatPolling('room');
      return () => {
        closeConversation();
        startChatPolling('list');
      };
    }, [closeConversation, conversationId, openConversation]),
  );

  const latestSeq = conversation?.lastSeq ?? 0;
  useEffect(() => {
    if (latestSeq > 0) void markRead(conversationId, latestSeq);
  }, [conversationId, latestSeq, markRead]);

  const rows = useMemo<Row[]>(() => {
    const receiptPeers = conversation?.kind === 'group'
      ? conversation.members.filter((member) => member.userId !== currentUser?.id && !member.leftAt)
      : [];
    const ordered = [...(messages ?? [])]
      .sort((a, b) => a.seq - b.seq)
      .map((message) => {
        if (!receiptPeers.length || message.senderId !== currentUser?.id) return message;
        const readByCount = receiptPeers.filter((member) => member.lastReadSeq >= message.seq).length;
        const deliveredToCount = receiptPeers.filter((member) => member.lastDeliveredSeq >= message.seq).length;
        return {
          ...message,
          readByCount,
          isReadByAll: readByCount === receiptPeers.length,
          deliveredToCount,
          isDeliveredToAll: deliveredToCount === receiptPeers.length,
        };
      });
    return ordered.map((message, index) => {
      const previous = ordered[index - 1];
      const next = ordered[index + 1];
      return {
        key: message.id,
        message,
        showDay: shouldStartNewDay(message, previous),
        showSender: conversation?.kind === 'group' && !isSameCluster(message, previous),
        isClusterEnd: !next || !isSameCluster(next, message),
      };
    });
  }, [conversation?.kind, conversation?.members, currentUser?.id, messages]);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);

  const newestSeq = rows.length ? rows[rows.length - 1].message.seq : 0;
  const hasLanded = useRef(false);
  // Follow the newest message only while the reader is already at the bottom. Anyone who
  // has scrolled up into history stays put, which is what makes "muat pesan sebelumnya" usable.
  const pinnedToBottom = useRef(true);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    pinnedToBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
      setIsKeyboardVisible(true);
      if (pinnedToBottom.current) scrollToEnd(false);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      setIsKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollToEnd]);

  useEffect(() => {
    if (!newestSeq || !pinnedToBottom.current) return;
    // Jump without animation on first paint, glide for every message after that.
    scrollToEnd(hasLanded.current);
    hasLanded.current = true;
  }, [newestSeq, scrollToEnd]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setIsSending(true);
    try {
      if (editingMessage) {
        await editMessage(editingMessage.id, body);
        setEditingMessage(null);
      } else {
        await sendMessage({ conversationId, body, replyToId: replyingTo?.id ?? null });
        setReplyingTo(null);
      }
      setDraft('');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      pinnedToBottom.current = true;
      scrollToEnd(true);
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Pesan belum dapat dikirim.');
    } finally {
      setIsSending(false);
    }
  }, [conversationId, draft, editMessage, editingMessage, replyingTo, scrollToEnd, sendMessage]);

  const handlePickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin diperlukan', 'Beri izin akses galeri untuk mengirim foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Compressed hard: the blob is stored in the database, so it has to stay small.
      quality: 0.55,
      base64: true,
      allowsEditing: false,
    });
    const asset = result.assets?.[0];
    if (!asset?.base64) return;
    if (asset.base64.length > MAX_IMAGE_BASE64) {
      Alert.alert('Foto terlalu besar', 'Pilih foto dengan resolusi lebih kecil lalu coba lagi.');
      return;
    }
    setIsSending(true);
    try {
      await sendMessage({
        conversationId,
        body: draft.trim(),
        replyToId: replyingTo?.id ?? null,
        attachment: {
          data: asset.base64,
          mimeType: asset.mimeType ?? 'image/jpeg',
          width: asset.width,
          height: asset.height,
        },
        localImageUri: asset.uri,
      });
      setDraft('');
      setReplyingTo(null);
      pinnedToBottom.current = true;
      scrollToEnd(true);
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Foto belum dapat dikirim.');
    } finally {
      setIsSending(false);
    }
  }, [conversationId, draft, replyingTo, scrollToEnd, sendMessage]);

  const handleStartRecording = useCallback(async () => {
    if (recordingBusy.current || isSending) return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Izin mikrofon diperlukan', 'Aktifkan izin mikrofon untuk merekam voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartedAt.current = Date.now();
      recordingDurationRef.current = 0;
      setRecordingDurationMs(0);
      setIsRecording(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      recordingLimitTimer.current = setTimeout(() => {
        void stopRecordingRef.current();
      }, MAX_RECORDING_MS);
    } catch (error) {
      Alert.alert('Tidak dapat merekam', error instanceof Error ? error.message : 'Mikrofon belum dapat digunakan.');
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [isSending, recorder]);

  const handleCancelRecording = useCallback(async () => {
    if (recordingBusy.current) return;
    recordingBusy.current = true;
    if (recordingLimitTimer.current) clearTimeout(recordingLimitTimer.current);
    recordingLimitTimer.current = null;
    try {
      await recorder.stop();
    } catch {
      // The recorder may already have stopped at the native duration limit.
    } finally {
      recordingStartedAt.current = null;
      recordingDurationRef.current = 0;
      setRecordingDurationMs(0);
      setIsRecording(false);
      recordingBusy.current = false;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [recorder]);

  const handleStopRecording = useCallback(async () => {
    if (recordingBusy.current) return;
    recordingBusy.current = true;
    if (recordingLimitTimer.current) clearTimeout(recordingLimitTimer.current);
    recordingLimitTimer.current = null;
    const elapsed = recordingStartedAt.current === null ? 0 : Date.now() - recordingStartedAt.current;
    const durationMs = Math.min(
      MAX_RECORDING_MS,
      Math.max(elapsed, recordingDurationRef.current),
    );
    setIsSending(true);
    try {
      await recorder.stop();
      // Release the recording route before the optimistic VN player mounts. Otherwise the
      // just-sent player can inherit the recorder session and stay silent until a relog.
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      }).catch(() => undefined);
      setIsRecording(false);
      const uri = recorder.uri;
      if (!uri || durationMs < 500) {
        Alert.alert('Voice note terlalu singkat', 'Rekam setidaknya setengah detik lalu coba lagi.');
        return;
      }
      const data = await audioUriToBase64(uri);
      if (data.length > MAX_AUDIO_BASE64) {
        Alert.alert('Voice note terlalu besar', 'Voice note maksimal dua menit. Coba rekam lebih singkat.');
        return;
      }
      await sendMessage({
        conversationId,
        body: draft.trim(),
        replyToId: replyingTo?.id ?? null,
        attachment: {
          data,
          mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
          durationMs,
        },
        localAudioUri: uri,
      });
      setDraft('');
      setReplyingTo(null);
      pinnedToBottom.current = true;
      scrollToEnd(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      Alert.alert('Gagal mengirim VN', error instanceof Error ? error.message : 'Voice note belum dapat dikirim.');
    } finally {
      recordingStartedAt.current = null;
      recordingDurationRef.current = 0;
      setRecordingDurationMs(0);
      setIsRecording(false);
      setIsSending(false);
      recordingBusy.current = false;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [conversationId, draft, recorder, replyingTo, scrollToEnd, sendMessage]);

  stopRecordingRef.current = handleStopRecording;

  // Keep the visible duration in JavaScript. useAudioRecorderState polls the native recorder;
  // that poll can race with expo-audio releasing its shared object during a screen unmount.
  useEffect(() => {
    if (!isRecording) return undefined;
    const updateDuration = () => {
      if (recordingStartedAt.current === null) return;
      const nextDuration = Math.min(MAX_RECORDING_MS, Date.now() - recordingStartedAt.current);
      recordingDurationRef.current = nextDuration;
      setRecordingDurationMs(nextDuration);
    };
    updateDuration();
    const timer = setInterval(updateDuration, 120);
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => () => {
    if (recordingLimitTimer.current) clearTimeout(recordingLimitTimer.current);
    recordingStartedAt.current = null;
    void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, []);

  const handleShareTransaction = useCallback(async (transaction: Transaction) => {
    setTransactionPickerVisible(false);
    setIsSending(true);
    try {
      await sendMessage({
        conversationId,
        body: draft.trim(),
        replyToId: replyingTo?.id ?? null,
        transactionId: transaction.id,
        transaction: transactionSummary(transaction),
      });
      setDraft('');
      setReplyingTo(null);
      pinnedToBottom.current = true;
      scrollToEnd(true);
    } catch (error) {
      Alert.alert('Gagal membagikan transaksi', error instanceof Error ? error.message : 'Transaksi belum dapat dikirim.');
    } finally {
      setIsSending(false);
    }
  }, [conversationId, draft, replyingTo, scrollToEnd, sendMessage]);

  const handleOpenTransaction = useCallback((message: ChatMessage) => {
    if (!message.transaction || message.outboxStatus) return;
    navigation.navigate('OrderDetail', {
      transactionId: message.transaction.id,
      chatMessageId: message.id,
    });
  }, [navigation]);

  const handleForward = useCallback(async (targetConversationIds: string[]) => {
    if (!forwardTarget) return;
    setIsForwarding(true);
    try {
      await forwardMessage(forwardTarget.id, targetConversationIds);
      setForwardTarget(null);
      Alert.alert('Pesan diteruskan', `Berhasil diteruskan ke ${targetConversationIds.length} obrolan.`);
    } catch (error) {
      Alert.alert('Gagal meneruskan', error instanceof Error ? error.message : 'Pesan belum dapat diteruskan.');
    } finally {
      setIsForwarding(false);
    }
  }, [forwardMessage, forwardTarget]);

  const handleLoadOlder = useCallback(async () => {
    if (!hasMore || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      await loadOlder(conversationId);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, hasMore, isLoadingOlder, loadOlder]);

  const handleDelete = useCallback(
    (message: ChatMessage) => {
      Alert.alert('Hapus pesan?', 'Pesan akan dihapus untuk semua anggota percakapan.', [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void deleteMessage(message.id).catch((error: unknown) =>
              Alert.alert('Gagal', error instanceof Error ? error.message : 'Pesan gagal dihapus.'),
            );
          },
        },
      ]);
    },
    [deleteMessage],
  );

  const isMine = useCallback(
    (message: ChatMessage) => message.senderId === currentUser?.id,
    [currentUser?.id],
  );

  const canEdit = actionTarget
    ? isMine(actionTarget) &&
      actionTarget.kind === 'text' &&
      !actionTarget.outboxStatus &&
      Date.now() - Date.parse(actionTarget.createdAt) < EDIT_WINDOW_MS
    : false;
  const canDelete = actionTarget
    ? (isMine(actionTarget) || conversation?.myMemberRole === 'admin') && !actionTarget.outboxStatus
    : false;

  const canShowReadInfo = Boolean(
    actionTarget &&
      conversation?.kind === 'group' &&
      isMine(actionTarget) &&
      !actionTarget.outboxStatus,
  );
  const receiptMembers = useMemo(
    () => (conversation?.members ?? []).filter(
      (member) => member.userId !== currentUser?.id && !member.leftAt,
    ),
    [conversation?.members, currentUser?.id],
  );
  const readMembers = useMemo(
    () => readInfoTarget
      ? receiptMembers.filter((member) => member.lastReadSeq >= readInfoTarget.seq)
      : [],
    [readInfoTarget, receiptMembers],
  );
  const unreadMembers = useMemo(
    () => readInfoTarget
      ? receiptMembers.filter((member) => member.lastReadSeq < readInfoTarget.seq)
      : [],
    [readInfoTarget, receiptMembers],
  );
  const actionReadByCount = actionTarget
    ? receiptMembers.filter((member) => member.lastReadSeq >= actionTarget.seq).length
    : 0;

  const returnToChatList = useCallback(() => {
    if (isLeavingRoom.current) return;
    isLeavingRoom.current = true;
    Keyboard.dismiss();
    // Always rebuild the root at the conversation list. Chat rooms can be opened from the
    // tab, search, a notification, or a deep link, so their previous stack is not reliable.
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Chat' } }],
    });
  }, [navigation]);

  const handleHeaderBack = useCallback(() => {
    if (recordingBusy.current || isLeavingRoom.current) return;
    if (isRecording) {
      void handleCancelRecording().then(returnToChatList);
      return;
    }
    returnToChatList();
  }, [handleCancelRecording, isRecording, returnToChatList]);

  const handleHardwareBack = useCallback((): boolean => {
    // Android back is contextual: the first press dismisses the IME, then a later press
    // leaves the room. Tracking this in a ref avoids navigating with stale keyboard state.
    if (keyboardVisibleRef.current) {
      keyboardVisibleRef.current = false;
      Keyboard.dismiss();
      return true;
    }
    if (actionTarget) {
      setActionTarget(null);
      return true;
    }
    if (readInfoTarget) {
      setReadInfoTarget(null);
      return true;
    }
    if (editingMessage) {
      setEditingMessage(null);
      setDraft('');
      return true;
    }
    if (replyingTo) {
      setReplyingTo(null);
      return true;
    }
    if (isRecording) {
      void handleCancelRecording();
      return true;
    }
    if (attachmentMenuVisible) {
      setAttachmentMenuVisible(false);
      return true;
    }
    if (transactionPickerVisible) {
      setTransactionPickerVisible(false);
      return true;
    }
    if (forwardTarget) {
      if (!isForwarding) setForwardTarget(null);
      return true;
    }
    returnToChatList();
    return true;
  }, [
    actionTarget,
    attachmentMenuVisible,
    editingMessage,
    forwardTarget,
    handleCancelRecording,
    isForwarding,
    isRecording,
    readInfoTarget,
    replyingTo,
    returnToChatList,
    transactionPickerVisible,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      return () => subscription.remove();
    }, [handleHardwareBack]),
  );

  const typingNames = conversation?.typingNames ?? [];
  const onlineGroupMembers = conversation?.kind === 'group'
    ? conversation.members.filter(
        (member) => member.userId !== currentUser?.id && !member.leftAt && member.isOnline,
      ).length
    : 0;
  const directRole = conversation?.counterpartRole ? roleLabels[conversation.counterpartRole] : null;
  const headerTitle = conversation?.kind === 'direct' && directRole
    ? `${conversation.title} - ${directRole}`
    : conversation?.title ?? 'Memuat…';
  const presenceLabel = typingNames.length
    ? conversation?.kind === 'group'
      ? `${typingNames.join(', ')} sedang mengetik…`
      : 'sedang mengetik…'
    : conversation?.kind === 'group'
      ? onlineGroupMembers > 0
        ? `${onlineGroupMembers} online`
        : `${conversation.memberCount} anggota`
      : conversation?.isOnline
        ? 'Online'
        : formatLastOnline(conversation?.lastSeenAt);

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xxs }]}>
        <ScalePressable
          accessibilityLabel="Kembali ke daftar obrolan"
          onPress={handleHeaderBack}
          style={styles.backButton}
        >
          <ChevronLeft color={palette.cocoaDark} size={24} strokeWidth={2.2} />
        </ScalePressable>
        <ScalePressable
          accessibilityHint="Membuka info percakapan"
          accessibilityLabel={`Info ${conversation?.title ?? 'percakapan'}`}
          containerStyle={styles.headerIdentityContainer}
          onPress={() => navigation.navigate('ChatInfo', { conversationId })}
          style={styles.headerIdentity}
        >
          <ChatAvatar
            accent={conversation?.accent ?? palette.cocoa}
            avatarUpdatedAt={conversation?.avatarUpdatedAt}
            initials={conversation?.initials ?? '··'}
            isGroup={conversation?.kind === 'group'}
            isOnline={conversation?.isOnline}
            size={40}
            userId={conversation?.avatarUserId}
          />
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>{headerTitle}</Text>
            <Text
              numberOfLines={1}
              style={[styles.headerSubtitle, typingNames.length > 0 && styles.headerSubtitleTyping]}
            >
              {presenceLabel}
            </Text>
          </View>
        </ScalePressable>
        <ScalePressable
          accessibilityLabel="Info percakapan"
          onPress={() => navigation.navigate('ChatInfo', { conversationId })}
          style={styles.backButton}
        >
          <Info color={palette.cocoaDark} size={21} strokeWidth={2.1} />
        </ScalePressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <FlatList
          contentContainerStyle={styles.listContent}
          data={rows}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(row) => row.key}
          ListEmptyComponent={
            isLoadingMessages ? (
              <ActivityIndicator color={palette.cocoa} style={styles.spinner} />
            ) : (
              <EmptyChatState
                body="Sapa rekan Anda — pesan pertama selalu yang paling berkesan."
                icon={MessageSquare}
                title="Belum ada pesan"
              />
            )
          }
          ListFooterComponent={typingNames.length ? <TypingIndicator names={typingNames} /> : null}
          ListHeaderComponent={
            hasMore ? (
              <ScalePressable
                accessibilityLabel="Muat pesan sebelumnya"
                onPress={() => void handleLoadOlder()}
                style={styles.loadOlder}
              >
                {isLoadingOlder ? (
                  <ActivityIndicator color={palette.cocoa} size="small" />
                ) : (
                  <Text style={styles.loadOlderText}>Muat pesan sebelumnya</Text>
                )}
              </ScalePressable>
            ) : null
          }
          onContentSizeChange={() => {
            // Rows measure asynchronously, so keep re-pinning until the layout settles.
            if (pinnedToBottom.current) scrollToEnd(false);
          }}
          onScroll={handleScroll}
          scrollEventThrottle={64}
          ref={listRef}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => (
            <View>
              {item.showDay ? <DateSeparator label={formatDayLabel(item.message.createdAt)} /> : null}
              <MessageBubble
                isClusterEnd={item.isClusterEnd}
                isMine={isMine(item.message)}
                message={item.message}
                onLongPress={setActionTarget}
                onOpenTransaction={handleOpenTransaction}
                onReact={(message, emoji) => {
                  void reactToMessage(message.id, emoji).catch(() => undefined);
                }}
                onReply={setReplyingTo}
                onRetry={(message) => {
                  if (message.clientMessageId) void retryMessage(message.clientMessageId);
                }}
                showSender={item.showSender}
              />
            </View>
          )}
        />

        <Composer
          bottomInset={Platform.OS === 'android' && isKeyboardVisible ? 0 : insets.bottom}
          editingMessage={editingMessage}
          isRecording={isRecording}
          isSending={isSending}
          onCancelRecording={() => void handleCancelRecording()}
          onCancelEdit={() => {
            setEditingMessage(null);
            setDraft('');
          }}
          onCancelReply={() => setReplyingTo(null)}
          onChangeText={(value) => {
            setDraft(value);
            if (value.trim()) notifyTyping(conversationId);
          }}
          onOpenAttachments={() => setAttachmentMenuVisible(true)}
          onSend={() => void handleSend()}
          onStartRecording={() => void handleStartRecording()}
          onStopRecording={() => void handleStopRecording()}
          recordingDurationMs={recordingDurationMs}
          replyingTo={replyingTo}
          value={draft}
        />
      </KeyboardAvoidingView>

      <MessageActionSheet
        canDelete={canDelete}
        canEdit={canEdit}
        canShowReadInfo={canShowReadInfo}
        message={actionTarget}
        onClose={() => setActionTarget(null)}
        onDelete={() => {
          if (actionTarget) handleDelete(actionTarget);
          setActionTarget(null);
        }}
        onEdit={() => {
          if (actionTarget) {
            setEditingMessage(actionTarget);
            setDraft(actionTarget.body);
            setReplyingTo(null);
          }
          setActionTarget(null);
        }}
        onForward={() => {
          setForwardTarget(actionTarget);
          setActionTarget(null);
        }}
        onShowReadInfo={() => {
          setReadInfoTarget(actionTarget);
          setActionTarget(null);
        }}
        onReact={(emoji) => {
          if (actionTarget) void reactToMessage(actionTarget.id, emoji).catch(() => undefined);
          setActionTarget(null);
        }}
        onReply={() => {
          setReplyingTo(actionTarget);
          setActionTarget(null);
        }}
        readByCount={actionReadByCount}
      />

      <FormModal
        onClose={() => setReadInfoTarget(null)}
        subtitle={readInfoTarget ? `Pesan dikirim ${lastOnlineDate.format(new Date(readInfoTarget.createdAt))}` : undefined}
        title="Info pesan"
        visible={Boolean(readInfoTarget)}
      >
        <View style={styles.receiptSummary}>
          <View style={styles.receiptSummaryIcon}>
            <CheckCheck color={palette.info} size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.receiptSummaryCopy}>
            <Text style={styles.receiptSummaryTitle}>Dibaca oleh {readMembers.length} orang</Text>
            <Text style={styles.receiptSummaryBody}>{unreadMembers.length} anggota belum membaca pesan ini</Text>
          </View>
        </View>
        <Text style={styles.receiptSectionTitle}>Dibaca oleh</Text>
        {readMembers.length ? readMembers.map((member) => (
          <View key={member.userId} style={styles.receiptMemberRow}>
            <ChatAvatar
              accent={member.accent}
              avatarUpdatedAt={member.avatarUpdatedAt}
              initials={member.initials}
              isOnline={member.isOnline}
              size={42}
              userId={member.userId}
            />
            <View style={styles.receiptMemberCopy}>
              <Text numberOfLines={1} style={styles.receiptMemberName}>{member.name}</Text>
              <Text numberOfLines={1} style={styles.receiptMemberMeta}>{roleLabels[member.role]} · Sudah dibaca</Text>
            </View>
            <CheckCheck color={palette.info} size={19} strokeWidth={2.5} />
          </View>
        )) : (
          <Text style={styles.receiptEmpty}>Belum ada anggota lain yang membaca pesan ini.</Text>
        )}
        {unreadMembers.length ? (
          <>
            <Text style={styles.receiptSectionTitle}>Belum dibaca</Text>
            {unreadMembers.map((member) => (
              <View key={member.userId} style={styles.receiptMemberRow}>
                <ChatAvatar
                  accent={member.accent}
                  avatarUpdatedAt={member.avatarUpdatedAt}
                  initials={member.initials}
                  isOnline={member.isOnline}
                  size={42}
                  userId={member.userId}
                />
                <View style={styles.receiptMemberCopy}>
                  <Text numberOfLines={1} style={styles.receiptMemberName}>{member.name}</Text>
                  <Text numberOfLines={1} style={styles.receiptMemberMeta}>{roleLabels[member.role]}</Text>
                </View>
                <Check color={palette.muted} size={18} strokeWidth={2.3} />
              </View>
            ))}
          </>
        ) : null}
      </FormModal>

      <FormModal
        onClose={() => setAttachmentMenuVisible(false)}
        subtitle="Tambahkan media atau bagikan transaksi lunas maupun bayar nanti ke obrolan ini."
        title="Tambahkan ke pesan"
        visible={attachmentMenuVisible}
      >
        <View style={styles.attachmentChoices}>
          <ScalePressable
            accessibilityLabel="Pilih foto dari galeri"
            onPress={() => {
              setAttachmentMenuVisible(false);
              void handlePickImage();
            }}
            style={styles.attachmentChoice}
          >
            <View style={styles.attachmentChoiceIcon}>
              <ImageIcon color={palette.cocoa} size={23} />
            </View>
            <View style={styles.attachmentChoiceCopy}>
              <Text style={styles.attachmentChoiceTitle}>Foto</Text>
              <Text style={styles.attachmentChoiceBody}>Pilih gambar dari galeri perangkat</Text>
            </View>
          </ScalePressable>
          <ScalePressable
            accessibilityLabel="Pilih transaksi"
            onPress={() => {
              setAttachmentMenuVisible(false);
              setTransactionPickerVisible(true);
            }}
            style={styles.attachmentChoice}
          >
            <View style={[styles.attachmentChoiceIcon, styles.transactionChoiceIcon]}>
              <ReceiptText color={palette.cocoa} size={23} />
            </View>
            <View style={styles.attachmentChoiceCopy}>
              <Text style={styles.attachmentChoiceTitle}>Transaksi</Text>
              <Text style={styles.attachmentChoiceBody}>Bagikan transaksi lunas atau bayar nanti</Text>
            </View>
          </ScalePressable>
        </View>
      </FormModal>

      <TransactionPicker
        onClose={() => setTransactionPickerVisible(false)}
        onSelect={(transaction) => void handleShareTransaction(transaction)}
        visible={transactionPickerVisible}
      />

      <ForwardPicker
        conversations={conversations}
        loading={isForwarding}
        message={forwardTarget}
        onClose={() => {
          if (!isForwarding) setForwardTarget(null);
        }}
        onSubmit={(ids) => void handleForward(ids)}
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: 'rgba(255,253,249,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentityContainer: { flex: 1, minWidth: 0 },
  headerIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15.5 },
  headerSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 11.5, marginTop: 1 },
  headerSubtitleTyping: { color: palette.success, fontFamily: type.semibold },
  listContent: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, flexGrow: 1, justifyContent: 'flex-end' },
  spinner: { marginTop: spacing.xl },
  loadOlder: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: spacing.xs,
  },
  loadOlderText: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 12 },
  attachmentChoices: { gap: spacing.xs },
  attachmentChoice: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
  },
  attachmentChoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.roseSoft,
  },
  transactionChoiceIcon: { backgroundColor: palette.champagneSoft },
  attachmentChoiceCopy: { flex: 1, gap: 2 },
  attachmentChoiceTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  attachmentChoiceBody: { color: palette.muted, fontFamily: type.regular, fontSize: 12 },
  receiptSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: palette.infoSoft },
  receiptSummaryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.white },
  receiptSummaryCopy: { flex: 1, gap: 2 },
  receiptSummaryTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  receiptSummaryBody: { color: palette.muted, fontFamily: type.regular, fontSize: 11.5 },
  receiptSectionTitle: { color: palette.inkSoft, fontFamily: type.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xs },
  receiptMemberRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxs, borderBottomWidth: 1, borderBottomColor: palette.line },
  receiptMemberCopy: { flex: 1, gap: 2 },
  receiptMemberName: { color: palette.ink, fontFamily: type.semibold, fontSize: 13.5 },
  receiptMemberMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 11 },
  receiptEmpty: { color: palette.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, paddingVertical: spacing.sm },
});
