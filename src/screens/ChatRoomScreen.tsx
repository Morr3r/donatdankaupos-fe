import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Info, MessageSquare } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { AppBackground, ScalePressable } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { startChatPolling, useChatStore } from '../store/chatStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ChatMessage } from '../types/domain';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ChatRoom'>;

/** Edits stay open for the same 15 minutes the API allows, so the menu never offers a dead action. */
const EDIT_WINDOW_MS = 15 * 60_000;
const MAX_IMAGE_BASE64 = 690_000;

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

  const conversationId = params.conversationId;
  const currentUser = useSessionStore((state) => state.user);
  const conversation = useChatStore((state) =>
    state.conversations.find((item) => item.id === conversationId),
  );
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
  const reactToMessage = useChatStore((state) => state.reactToMessage);
  const markRead = useChatStore((state) => state.markRead);
  const notifyTyping = useChatStore((state) => state.notifyTyping);

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

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
    const ordered = [...(messages ?? [])].sort((a, b) => a.seq - b.seq);
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
  }, [conversation?.kind, messages]);

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

  const typingNames = conversation?.typingNames ?? [];
  const presenceLabel = typingNames.length
    ? conversation?.kind === 'group'
      ? `${typingNames.join(', ')} sedang mengetik…`
      : 'sedang mengetik…'
    : conversation?.kind === 'group'
      ? `${conversation.memberCount} anggota`
      : conversation?.isOnline
        ? 'online'
        : (conversation?.subtitle ?? '');

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xxs }]}>
        <ScalePressable accessibilityLabel="Kembali" onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={palette.cocoaDark} size={24} strokeWidth={2.2} />
        </ScalePressable>
        <ScalePressable
          accessibilityHint="Membuka info percakapan"
          accessibilityLabel={`Info ${conversation?.title ?? 'percakapan'}`}
          onPress={() => navigation.navigate('ChatInfo', { conversationId })}
          style={styles.headerIdentity}
        >
          <ChatAvatar
            accent={conversation?.accent ?? palette.cocoa}
            initials={conversation?.initials ?? '··'}
            isGroup={conversation?.kind === 'group'}
            isOnline={conversation?.isOnline}
            size={40}
          />
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>{conversation?.title ?? 'Memuat…'}</Text>
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <FlatList
          contentContainerStyle={styles.listContent}
          data={rows}
          keyboardDismissMode="interactive"
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
          bottomInset={insets.bottom}
          editingMessage={editingMessage}
          isSending={isSending}
          onCancelEdit={() => {
            setEditingMessage(null);
            setDraft('');
          }}
          onCancelReply={() => setReplyingTo(null)}
          onChangeText={(value) => {
            setDraft(value);
            if (value.trim()) notifyTyping(conversationId);
          }}
          onPickImage={() => void handlePickImage()}
          onSend={() => void handleSend()}
          replyingTo={replyingTo}
          value={draft}
        />
      </KeyboardAvoidingView>

      <MessageActionSheet
        canDelete={canDelete}
        canEdit={canEdit}
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
        onReact={(emoji) => {
          if (actionTarget) void reactToMessage(actionTarget.id, emoji).catch(() => undefined);
          setActionTarget(null);
        }}
        onReply={() => {
          setReplyingTo(actionTarget);
          setActionTarget(null);
        }}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerCopy: { flex: 1 },
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
});
