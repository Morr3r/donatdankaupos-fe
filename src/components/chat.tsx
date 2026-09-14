import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Forward,
  ImageIcon,
  Mic,
  Paperclip,
  Pause,
  Pin,
  Play,
  ReceiptText,
  Reply,
  RotateCw,
  Send,
  Users,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { palette, radius, shadow, spacing, type } from '../theme/tokens';
import type { ChatConversation, ChatMessage } from '../types/domain';
import { formatCurrency } from '../utils/format';
import { useChatStore } from '../store/chatStore';
import { useReducedMotion } from '../utils/useReducedMotion';
import { ScalePressable } from './ui';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'] as const;

const clockFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Jakarta',
});

const dayFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Jakarta',
});

export const formatMessageClock = (value: string): string => clockFormatter.format(new Date(value));

const dayKey = (value: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(value));

/** "Hari ini" / "Kemarin" / the full date, matching how people scan a transcript. */
export function formatDayLabel(value: string): string {
  const key = dayKey(value);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return 'Hari ini';
  if (key === yesterday) return 'Kemarin';
  return dayFormatter.format(new Date(value));
}

/** Relative stamp for the conversation list: clock today, weekday this week, else a date. */
export function formatListStamp(value?: string | null): string {
  if (!value) return '';
  const key = dayKey(value);
  const today = dayKey(new Date().toISOString());
  if (key === today) return clockFormatter.format(new Date(value));
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === yesterday) return 'Kemarin';
  const age = Date.now() - Date.parse(value);
  if (age < 7 * 86_400_000) {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
  }
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(
    new Date(value),
  );
}

export function shouldStartNewDay(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return true;
  return dayKey(current.createdAt) !== dayKey(previous.createdAt);
}

/** Consecutive messages from one sender within five minutes collapse into a single cluster. */
export function isSameCluster(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous || previous.kind === 'system' || current.kind === 'system') return false;
  if (previous.senderId !== current.senderId) return false;
  if (shouldStartNewDay(current, previous)) return false;
  return Date.parse(current.createdAt) - Date.parse(previous.createdAt) < 5 * 60_000;
}

interface AvatarProps {
  initials: string;
  accent: string;
  size?: number;
  isOnline?: boolean;
  isGroup?: boolean;
}

export function ChatAvatar({ initials, accent, size = 52, isOnline, isGroup }: AvatarProps) {
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={[accent, shadeColor(accent, -22)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {isGroup ? (
          <Users color={palette.white} size={size * 0.42} strokeWidth={2.2} />
        ) : (
          <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
        )}
      </LinearGradient>
      {isOnline ? <View style={[styles.presenceDot, { right: size * 0.02, bottom: size * 0.02 }]} /> : null}
    </View>
  );
}

/** Darken or lighten a hex accent so the avatar reads as a gradient, not a flat disc. */
function shadeColor(hex: string, percent: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const value = parseInt(normalized, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel + (channel * percent) / 100))),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.daySeparator}>
      <View style={styles.dayPill}>
        <Text style={styles.dayPillText}>{label}</Text>
      </View>
    </View>
  );
}

export function SystemMessage({ body }: { body: string }) {
  return (
    <View style={styles.daySeparator}>
      <View style={styles.systemPill}>
        <Text style={styles.systemPillText}>{body}</Text>
      </View>
    </View>
  );
}

/** ✓ sent · ✓✓ delivered to someone · blue ✓✓ read by everyone else in the room. */
function DeliveryTicks({ message }: { message: ChatMessage }) {
  if (message.outboxStatus === 'sending') return <Clock color="rgba(255,255,255,0.7)" size={13} strokeWidth={2.4} />;
  if (message.outboxStatus === 'failed') return <RotateCw color={palette.roseSoft} size={13} strokeWidth={2.4} />;
  if (message.isReadByAll) return <CheckCheck color="#7FD1FF" size={15} strokeWidth={2.6} />;
  if (message.isDeliveredToAll || message.deliveredToCount > 0) {
    return <CheckCheck color="rgba(255,255,255,0.72)" size={15} strokeWidth={2.4} />;
  }
  return <Check color="rgba(255,255,255,0.72)" size={15} strokeWidth={2.4} />;
}

function AttachmentImage({ message, tone }: { message: ChatMessage; tone: 'mine' | 'theirs' }) {
  const loadAttachment = useChatStore((state) => state.loadAttachment);
  const cached = useChatStore((state) =>
    message.attachment ? state.attachmentCache[message.attachment.id] : undefined,
  );
  const [failed, setFailed] = useState(false);
  const attachmentId = message.attachment?.id;

  useEffect(() => {
    if (!attachmentId || cached) return;
    let cancelled = false;
    void loadAttachment(attachmentId).then((result) => {
      if (!cancelled && !result) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [attachmentId, cached, loadAttachment]);

  // Reserve the real aspect ratio up front so the transcript never jumps as blobs arrive.
  const ratio = message.attachment?.width && message.attachment?.height
    ? Math.min(Math.max(message.attachment.width / message.attachment.height, 0.6), 1.8)
    : 1;
  const source = message.localImageUri ?? cached ?? message.attachment?.thumbnail ?? null;

  return (
    <View style={[styles.attachmentFrame, { aspectRatio: ratio }]}>
      {source ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Foto dalam pesan"
          blurRadius={!message.localImageUri && !cached ? 8 : 0}
          source={{ uri: source }}
          style={styles.attachmentImage}
        />
      ) : (
        <View style={[styles.attachmentImage, styles.attachmentPlaceholder]}>
          {failed ? (
            <ImageIcon color={palette.muted} size={26} />
          ) : (
            <ActivityIndicator color={tone === 'mine' ? palette.white : palette.cocoa} />
          )}
        </View>
      )}
      {!message.localImageUri && !cached && !failed ? (
        <View style={styles.attachmentSpinner}>
          <ActivityIndicator color={palette.white} />
        </View>
      ) : null}
    </View>
  );
}

const formatAudioTime = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

function VoiceNotePlayer({ message, tone }: { message: ChatMessage; tone: 'mine' | 'theirs' }) {
  const loadAttachment = useChatStore((state) => state.loadAttachment);
  const cached = useChatStore((state) =>
    message.attachment ? state.attachmentCache[message.attachment.id] : undefined,
  );
  const attachmentId = message.attachment?.id;
  const source = message.localAudioUri ?? cached ?? null;
  const player = useAudioPlayer(source ? { uri: source } : null, { updateInterval: 120 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!attachmentId || cached || message.localAudioUri) return;
    void loadAttachment(attachmentId);
  }, [attachmentId, cached, loadAttachment, message.localAudioUri]);

  const duration = status.duration || (message.attachment?.durationMs ?? 0) / 1000;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const toggle = async () => {
    if (!source) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.15)) {
      await player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.audioPlayer}>
      <ScalePressable
        accessibilityLabel={status.playing ? 'Jeda voice note' : 'Putar voice note'}
        disabled={!source}
        onPress={() => void toggle()}
        style={[styles.audioButton, tone === 'mine' && styles.audioButtonMine]}
      >
        {!source ? (
          <ActivityIndicator color={tone === 'mine' ? palette.cocoa : palette.white} size="small" />
        ) : status.playing ? (
          <Pause color={tone === 'mine' ? palette.cocoa : palette.white} fill={tone === 'mine' ? palette.cocoa : palette.white} size={18} />
        ) : (
          <Play color={tone === 'mine' ? palette.cocoa : palette.white} fill={tone === 'mine' ? palette.cocoa : palette.white} size={18} />
        )}
      </ScalePressable>
      <View style={styles.audioCopy}>
        <View style={[styles.audioTrack, tone === 'mine' && styles.audioTrackMine]}>
          <View
            style={[
              styles.audioProgress,
              tone === 'mine' && styles.audioProgressMine,
              { width: `${progress * 100}%` },
            ]}
          />
        </View>
        <View style={styles.audioLabels}>
          <Text style={[styles.audioTime, tone === 'mine' && styles.audioTimeMine]}>
            {formatAudioTime(status.playing ? status.currentTime : duration)}
          </Text>
          <Mic color={tone === 'mine' ? 'rgba(255,255,255,0.68)' : palette.muted} size={13} />
        </View>
      </View>
    </View>
  );
}

function TransactionCard({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  const transaction = message.transaction;
  if (!transaction) return null;
  return (
    <View style={[styles.transactionCard, isMine && styles.transactionCardMine]}>
      <View style={[styles.transactionIcon, isMine && styles.transactionIconMine]}>
        <ReceiptText color={isMine ? palette.cocoa : palette.white} size={19} />
      </View>
      <View style={styles.transactionCopy}>
        <Text numberOfLines={1} style={[styles.transactionReceipt, isMine && styles.transactionTextMine]}>
          {transaction.receiptNo}
        </Text>
        <Text style={[styles.transactionMeta, isMine && styles.transactionMetaMine]}>
          {transaction.itemCount} item · {transaction.pieceCount} pcs
        </Text>
        {transaction.customerName ? (
          <Text numberOfLines={1} style={[styles.transactionMeta, isMine && styles.transactionMetaMine]}>
            {transaction.customerName}
          </Text>
        ) : null}
      </View>
      <View style={styles.transactionAmountCopy}>
        <Text style={[styles.transactionAmount, isMine && styles.transactionTextMine]}>
          {formatCurrency(transaction.total)}
        </Text>
        <Text style={[styles.transactionStatus, transaction.status === 'refunded' && styles.transactionRefunded]}>
          {transaction.status === 'refunded' ? 'Refund' : 'Selesai'}
        </Text>
      </View>
    </View>
  );
}

interface BubbleProps {
  message: ChatMessage;
  isMine: boolean;
  showSender: boolean;
  isClusterEnd: boolean;
  onLongPress: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  showSender,
  isClusterEnd,
  onLongPress,
  onReply,
  onRetry,
  onReact,
}: BubbleProps) {
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const replyArmed = useRef(false);

  // Swipe toward the centre of the screen to reply, the gesture people already know.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => {
          if (message.deletedAt || message.kind === 'system' || reducedMotion) return false;
          const forward = isMine ? -gesture.dx : gesture.dx;
          return forward > 12 && Math.abs(gesture.dy) < 14;
        },
        onPanResponderMove: (_event, gesture) => {
          const forward = isMine ? -gesture.dx : gesture.dx;
          const clamped = Math.max(0, Math.min(forward, 76));
          translateX.setValue(isMine ? -clamped : clamped);
          if (clamped > 54 && !replyArmed.current) {
            replyArmed.current = true;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          }
        },
        onPanResponderRelease: () => {
          if (replyArmed.current) onReply(message);
          replyArmed.current = false;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
            speed: 20,
            bounciness: 6,
          }).start();
        },
      }),
    [isMine, message, onReply, reducedMotion, translateX],
  );

  if (message.kind === 'system') return <SystemMessage body={message.body} />;

  const isDeleted = Boolean(message.deletedAt);
  const failed = message.outboxStatus === 'failed';

  return (
    <View style={styles.bubbleRow} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.bubbleShift,
          isMine ? styles.bubbleShiftMine : styles.bubbleShiftTheirs,
          { transform: [{ translateX }] },
        ]}
      >
        <View style={styles.replyHint}>
          <Reply color={palette.muted} size={15} strokeWidth={2.2} />
        </View>
        <Pressable
          accessibilityHint="Tekan lama untuk membalas, bereaksi, atau menghapus"
          accessibilityLabel={`${message.senderName}: ${isDeleted ? 'Pesan dihapus' : previewText(message)}`}
          accessibilityRole="button"
          delayLongPress={260}
          onLongPress={() => {
            if (isDeleted) return;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            onLongPress(message);
          }}
          onPress={failed ? () => onRetry(message) : undefined}
          style={({ pressed }) => [
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            isClusterEnd && (isMine ? styles.bubbleTailMine : styles.bubbleTailTheirs),
            isDeleted && styles.bubbleDeleted,
            failed && styles.bubbleFailed,
            pressed && styles.bubblePressed,
          ]}
        >
          {showSender && !isMine ? <Text style={styles.bubbleSender}>{message.senderName}</Text> : null}

          {message.systemData.forwarded === true && !isDeleted ? (
            <Text style={[styles.forwardedLabel, isMine && styles.forwardedLabelMine]}>Diteruskan</Text>
          ) : null}

          {message.replyTo ? (
            <View style={[styles.replyQuote, isMine ? styles.replyQuoteMine : styles.replyQuoteTheirs]}>
              <Text numberOfLines={1} style={[styles.replyQuoteName, isMine && styles.replyQuoteNameMine]}>
                {message.replyTo.senderName}
              </Text>
              <Text numberOfLines={2} style={[styles.replyQuoteBody, isMine && styles.replyQuoteBodyMine]}>
                {message.replyTo.isDeleted ? 'Pesan ini telah dihapus' : message.replyTo.preview}
              </Text>
            </View>
          ) : null}

          {message.kind === 'image' && !isDeleted ? (
            <AttachmentImage message={message} tone={isMine ? 'mine' : 'theirs'} />
          ) : null}

          {message.kind === 'audio' && !isDeleted ? (
            <VoiceNotePlayer message={message} tone={isMine ? 'mine' : 'theirs'} />
          ) : null}

          {message.kind === 'transaction' && !isDeleted ? (
            <TransactionCard isMine={isMine} message={message} />
          ) : null}

          {isDeleted ? (
            <Text style={[styles.bubbleText, styles.bubbleTextDeleted, isMine && styles.bubbleTextMine]}>
              🚫 Pesan ini telah dihapus
            </Text>
          ) : message.body ? (
            <Text selectable style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
              {message.body}
            </Text>
          ) : null}

          <View style={styles.bubbleMeta}>
            {message.editedAt && !isDeleted ? (
              <Text style={[styles.bubbleStamp, isMine && styles.bubbleStampMine]}>diedit</Text>
            ) : null}
            <Text style={[styles.bubbleStamp, isMine && styles.bubbleStampMine]}>
              {formatMessageClock(message.createdAt)}
            </Text>
            {isMine && !isDeleted ? <DeliveryTicks message={message} /> : null}
          </View>

          {failed ? <Text style={styles.failedHint}>Gagal terkirim · ketuk untuk coba lagi</Text> : null}
        </Pressable>

        {message.reactions.length ? (
          <View style={[styles.reactionTray, isMine ? styles.reactionTrayMine : styles.reactionTrayTheirs]}>
            {message.reactions.map((reaction) => (
              <ScalePressable
                accessibilityLabel={`${reaction.emoji} ${reaction.count} dari ${reaction.userNames.join(', ')}`}
                key={reaction.emoji}
                onPress={() => onReact(message, reaction.emoji)}
                style={[styles.reactionChip, reaction.reactedByMe && styles.reactionChipMine]}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                {reaction.count > 1 ? <Text style={styles.reactionCount}>{reaction.count}</Text> : null}
              </ScalePressable>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
});

export function TypingIndicator({ names }: { names: string[] }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return undefined;
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dot, { toValue: 0, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
          Animated.delay((2 - index) * 140),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots, reducedMotion]);

  if (!names.length) return null;
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.32, 1] }) },
              { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

interface ComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onOpenAttachments: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  isRecording: boolean;
  recordingDurationMs: number;
  replyingTo?: ChatMessage | null;
  onCancelReply: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit: () => void;
  isSending: boolean;
  bottomInset: number;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  onOpenAttachments,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  isRecording,
  recordingDurationMs,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  isSending,
  bottomInset,
}: ComposerProps) {
  const canSend = value.trim().length > 0 && !isSending;
  return (
    <View style={[styles.composerShell, { paddingBottom: Math.max(bottomInset, spacing.xs) }]}>
      {replyingTo ? (
        <View style={styles.composerBanner}>
          <View style={styles.composerBannerBar} />
          <View style={styles.composerBannerCopy}>
            <Text style={styles.composerBannerTitle}>Membalas {replyingTo.senderName}</Text>
            <Text numberOfLines={1} style={styles.composerBannerBody}>
              {previewText(replyingTo)}
            </Text>
          </View>
          <ScalePressable accessibilityLabel="Batalkan balasan" onPress={onCancelReply} style={styles.composerBannerClose}>
            <X color={palette.muted} size={18} strokeWidth={2.2} />
          </ScalePressable>
        </View>
      ) : null}

      {editingMessage ? (
        <View style={styles.composerBanner}>
          <View style={[styles.composerBannerBar, styles.composerBannerBarEdit]} />
          <View style={styles.composerBannerCopy}>
            <Text style={styles.composerBannerTitle}>Mengedit pesan</Text>
            <Text numberOfLines={1} style={styles.composerBannerBody}>{editingMessage.body}</Text>
          </View>
          <ScalePressable accessibilityLabel="Batalkan edit" onPress={onCancelEdit} style={styles.composerBannerClose}>
            <X color={palette.muted} size={18} strokeWidth={2.2} />
          </ScalePressable>
        </View>
      ) : null}

      <View style={styles.composerRow}>
        {isRecording ? (
          <>
            <ScalePressable accessibilityLabel="Batalkan voice note" onPress={onCancelRecording} style={styles.composerAttach}>
              <X color={palette.danger} size={21} strokeWidth={2.2} />
            </ScalePressable>
            <View accessibilityLabel={`Merekam voice note ${formatAudioTime(recordingDurationMs / 1000)}`} style={styles.recordingPanel}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>{formatAudioTime(recordingDurationMs / 1000)}</Text>
              <Text style={styles.recordingHint}>Merekam voice note</Text>
            </View>
          </>
        ) : (
          <>
            {!editingMessage ? (
              <ScalePressable accessibilityLabel="Tambahkan lampiran" onPress={onOpenAttachments} style={styles.composerAttach}>
                <Paperclip color={palette.cocoa} size={21} strokeWidth={2} />
              </ScalePressable>
            ) : null}
            <TextInput
              accessibilityLabel="Tulis pesan"
              multiline
              onChangeText={onChangeText}
              placeholder="Tulis pesan…"
              placeholderTextColor={palette.muted}
              style={styles.composerInput}
              value={value}
            />
          </>
        )}
        <ScalePressable
          accessibilityLabel={
            isRecording ? 'Kirim voice note' : editingMessage ? 'Simpan perubahan' : canSend ? 'Kirim pesan' : 'Rekam voice note'
          }
          disabled={isSending || (Boolean(editingMessage) && !canSend)}
          onPress={isRecording ? onStopRecording : canSend ? onSend : onStartRecording}
          style={[styles.composerSend, isSending && styles.composerSendDisabled]}
        >
          {isSending ? (
            <ActivityIndicator color={palette.white} size="small" />
          ) : isRecording ? (
            <Send color={palette.white} size={19} strokeWidth={2.3} />
          ) : editingMessage ? (
            <Check color={palette.white} size={20} strokeWidth={2.6} />
          ) : canSend ? (
            <Send color={palette.white} size={19} strokeWidth={2.3} />
          ) : (
            <Mic color={palette.white} size={20} strokeWidth={2.3} />
          )}
        </ScalePressable>
      </View>
    </View>
  );
}

interface ConversationRowProps {
  conversation: ChatConversation;
  onPress: () => void;
  onLongPress: () => void;
}

export const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
  onLongPress,
}: ConversationRowProps) {
  const typing = conversation.typingNames.length > 0;
  const preview = typing
    ? `${conversation.kind === 'group' ? `${conversation.typingNames[0]} ` : ''}sedang mengetik…`
    : conversation.lastMessage
      ? `${
          conversation.kind === 'group' && conversation.lastMessage.kind !== 'system'
            ? `${conversation.lastMessage.senderName.split(' ')[0]}: `
            : ''
        }${previewText(conversation.lastMessage)}`
      : 'Belum ada pesan';

  return (
    <Pressable
      accessibilityHint="Membuka percakapan"
      accessibilityLabel={`${conversation.title}. ${conversation.unreadCount ? `${conversation.unreadCount} pesan belum dibaca. ` : ''}${preview}`}
      accessibilityRole="button"
      delayLongPress={280}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.conversationRow, pressed && styles.conversationRowPressed]}
    >
      <ChatAvatar
        accent={conversation.accent}
        initials={conversation.initials}
        isGroup={conversation.kind === 'group'}
        isOnline={conversation.isOnline}
      />
      <View style={styles.conversationCopy}>
        <View style={styles.conversationTopLine}>
          <Text numberOfLines={1} style={styles.conversationTitle}>{conversation.title}</Text>
          <Text style={[styles.conversationStamp, conversation.unreadCount > 0 && styles.conversationStampUnread]}>
            {formatListStamp(conversation.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.conversationBottomLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.conversationPreview,
              typing && styles.conversationPreviewTyping,
              conversation.unreadCount > 0 && styles.conversationPreviewUnread,
            ]}
          >
            {preview}
          </Text>
          <View style={styles.conversationBadges}>
            {conversation.isPinned ? <Pin color={palette.muted} size={13} strokeWidth={2.2} /> : null}
            {conversation.isMuted ? <BellOff color={palette.muted} size={13} strokeWidth={2.2} /> : null}
            {conversation.unreadCount > 0 ? (
              <View style={[styles.unreadBadge, conversation.isMuted && styles.unreadBadgeMuted]}>
                <Text style={styles.unreadBadgeText}>
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export function previewText(message: ChatMessage): string {
  if (message.deletedAt) return 'Pesan ini telah dihapus';
  if (message.kind === 'image') return message.body ? `📷 ${message.body}` : '📷 Foto';
  if (message.kind === 'audio') return 'Voice note';
  if (message.kind === 'transaction') {
    return message.transaction ? `Transaksi ${message.transaction.receiptNo}` : 'Transaksi dibagikan';
  }
  return message.body;
}

interface ActionSheetProps {
  message: ChatMessage | null;
  canEdit: boolean;
  canDelete: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onClose: () => void;
}

export function MessageActionSheet({
  message,
  canEdit,
  canDelete,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onClose,
}: ActionSheetProps) {
  const appear = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!message) {
      appear.setValue(0);
      return;
    }
    if (reducedMotion) {
      appear.setValue(1);
      return;
    }
    Animated.spring(appear, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      speed: 18,
      bounciness: 6,
    }).start();
  }, [appear, message, reducedMotion]);

  if (!message) return null;

  const actions = [
    { label: 'Balas', icon: Reply, onPress: onReply, tone: 'default' as const },
    { label: 'Teruskan', icon: Forward, onPress: onForward, tone: 'default' as const },
    ...(canEdit ? [{ label: 'Edit pesan', icon: Send, onPress: onEdit, tone: 'default' as const }] : []),
    ...(canDelete ? [{ label: 'Hapus untuk semua', icon: X, onPress: onDelete, tone: 'danger' as const }] : []),
  ];

  return (
    <Pressable accessibilityLabel="Tutup menu pesan" onPress={onClose} style={styles.sheetScrim}>
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: appear,
            transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
          },
        ]}
      >
        <View style={styles.sheetReactions}>
          {QUICK_REACTIONS.map((emoji) => (
            <ScalePressable
              accessibilityLabel={`Beri reaksi ${emoji}`}
              key={emoji}
              onPress={() => onReact(emoji)}
              style={[
                styles.sheetReaction,
                message.reactions.some((item) => item.emoji === emoji && item.reactedByMe) &&
                  styles.sheetReactionActive,
              ]}
            >
              <Text style={styles.sheetReactionEmoji}>{emoji}</Text>
            </ScalePressable>
          ))}
        </View>
        <View style={styles.sheetActions}>
          {actions.map(({ label, icon: Icon, onPress, tone }) => (
            <ScalePressable accessibilityLabel={label} key={label} onPress={onPress} style={styles.sheetAction}>
              <Icon color={tone === 'danger' ? palette.danger : palette.cocoaDark} size={19} strokeWidth={2.1} />
              <Text style={[styles.sheetActionText, tone === 'danger' && styles.sheetActionTextDanger]}>{label}</Text>
            </ScalePressable>
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function EmptyChatState({ title, body, icon: Icon }: { title: string; body: string; icon: typeof Users }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon color={palette.cocoa} size={30} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export const useAutoScroll = (dependency: unknown) => {
  const ref = useRef<{ scrollToEnd: (options?: { animated?: boolean }) => void } | null>(null);
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => ref.current?.scrollToEnd({ animated }));
  }, []);
  useEffect(() => {
    scrollToEnd(true);
  }, [dependency, scrollToEnd]);
  return { ref, scrollToEnd };
};

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.white, fontFamily: type.bold, letterSpacing: 0.4 },
  presenceDot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: palette.success,
    borderWidth: 2.2,
    borderColor: palette.cream,
  },

  daySeparator: { alignItems: 'center', marginVertical: spacing.xs },
  dayPill: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: palette.line,
  },
  dayPillText: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 11, letterSpacing: 0.3 },
  systemPill: {
    backgroundColor: 'rgba(232, 140, 164, 0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    maxWidth: '86%',
  },
  systemPillText: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 11.5, textAlign: 'center' },

  bubbleRow: { width: '100%', paddingHorizontal: spacing.xs, marginBottom: 3 },
  bubbleShift: { maxWidth: '84%' },
  bubbleShiftMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleShiftTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  replyHint: {
    position: 'absolute',
    top: '42%',
    left: -34,
    opacity: 0.6,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
    minWidth: 74,
    ...shadow.glass,
  },
  bubbleMine: { backgroundColor: palette.cocoa },
  bubbleTheirs: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line },
  // The squared-off corner is the bubble tail; only the last of a cluster gets one.
  bubbleTailMine: { borderBottomRightRadius: 5 },
  bubbleTailTheirs: { borderBottomLeftRadius: 5 },
  bubbleDeleted: { opacity: 0.78 },
  bubbleFailed: { borderWidth: 1, borderColor: palette.danger },
  bubblePressed: { opacity: 0.9 },
  bubbleSender: { color: palette.rose, fontFamily: type.bold, fontSize: 12, marginBottom: 2 },
  bubbleText: { color: palette.ink, fontFamily: type.regular, fontSize: 14.5, lineHeight: 20 },
  bubbleTextMine: { color: palette.white },
  bubbleTextDeleted: { fontStyle: 'italic', opacity: 0.82 },
  forwardedLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10.5, marginBottom: 4 },
  forwardedLabelMine: { color: 'rgba(255,255,255,0.68)' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: 2 },
  bubbleStamp: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  bubbleStampMine: { color: 'rgba(255,255,255,0.72)' },
  failedHint: { color: palette.danger, fontFamily: type.semibold, fontSize: 10.5, marginTop: 3 },

  replyQuote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 5,
  },
  replyQuoteTheirs: { backgroundColor: 'rgba(107,63,42,0.07)', borderLeftColor: palette.rose },
  replyQuoteMine: { backgroundColor: 'rgba(255,255,255,0.16)', borderLeftColor: palette.champagne },
  replyQuoteName: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11.5 },
  replyQuoteNameMine: { color: palette.champagne },
  replyQuoteBody: { color: palette.inkSoft, fontFamily: type.regular, fontSize: 12 },
  replyQuoteBodyMine: { color: 'rgba(255,255,255,0.82)' },

  attachmentFrame: {
    width: 232,
    maxWidth: '100%',
    borderRadius: 13,
    overflow: 'hidden',
    marginBottom: 5,
    backgroundColor: 'rgba(107,63,42,0.08)',
  },
  attachmentImage: { width: '100%', height: '100%' },
  attachmentPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  attachmentSpinner: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  audioPlayer: { width: 232, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  audioButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoa },
  audioButtonMine: { backgroundColor: palette.champagneSoft },
  audioCopy: { flex: 1, gap: 6 },
  audioTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(107,63,42,0.14)' },
  audioTrackMine: { backgroundColor: 'rgba(255,255,255,0.24)' },
  audioProgress: { height: '100%', borderRadius: 2, backgroundColor: palette.cocoa },
  audioProgressMine: { backgroundColor: palette.champagne },
  audioLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audioTime: { color: palette.muted, fontFamily: type.medium, fontSize: 10.5 },
  audioTimeMine: { color: 'rgba(255,255,255,0.72)' },

  transactionCard: {
    width: 282,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(107,63,42,0.06)',
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.xs,
    marginBottom: 4,
  },
  transactionCardMine: { backgroundColor: 'rgba(255,255,255,0.13)', borderColor: 'rgba(255,255,255,0.18)' },
  transactionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoa },
  transactionIconMine: { backgroundColor: palette.champagneSoft },
  transactionCopy: { flex: 1, gap: 1 },
  transactionReceipt: { color: palette.ink, fontFamily: type.bold, fontSize: 12.5 },
  transactionTextMine: { color: palette.white },
  transactionMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10.5 },
  transactionMetaMine: { color: 'rgba(255,255,255,0.72)' },
  transactionAmountCopy: { alignItems: 'flex-end', gap: 2 },
  transactionAmount: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11.5 },
  transactionStatus: { color: palette.success, fontFamily: type.semibold, fontSize: 9.5 },
  transactionRefunded: { color: palette.roseSoft },

  reactionTray: { flexDirection: 'row', gap: 4, marginTop: -7, marginBottom: 5, zIndex: 2 },
  reactionTrayMine: { marginRight: 6 },
  reactionTrayTheirs: { marginLeft: 6 },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadow.glass,
  },
  reactionChipMine: { borderColor: palette.rose, backgroundColor: palette.roseSoft },
  reactionEmoji: { fontSize: 12.5 },
  reactionCount: { color: palette.inkSoft, fontFamily: type.bold, fontSize: 10.5 },

  typingBubble: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 13, minWidth: 58 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.muted },

  composerShell: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    backgroundColor: 'rgba(255,253,249,0.97)',
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  composerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(107,63,42,0.06)',
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  composerBannerBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: palette.rose },
  composerBannerBarEdit: { backgroundColor: palette.honey },
  composerBannerCopy: { flex: 1 },
  composerBannerTitle: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11.5 },
  composerBannerBody: { color: palette.inkSoft, fontFamily: type.regular, fontSize: 12 },
  composerBannerClose: { padding: 4 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  composerAttach: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 128,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.sm,
    paddingTop: 11,
    paddingBottom: 11,
    color: palette.ink,
    fontFamily: type.regular,
    fontSize: 14.5,
  },
  recordingPanel: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.rose,
    backgroundColor: palette.roseSoft,
    paddingHorizontal: spacing.sm,
  },
  recordingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.danger },
  recordingTime: { color: palette.danger, fontFamily: type.bold, fontSize: 13 },
  recordingHint: { flex: 1, color: palette.inkSoft, fontFamily: type.medium, fontSize: 12 },
  composerSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cocoa,
    ...shadow.glass,
  },
  composerSendDisabled: { backgroundColor: palette.muted, opacity: 0.5 },

  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  conversationRowPressed: { backgroundColor: 'rgba(107,63,42,0.06)' },
  conversationCopy: { flex: 1, gap: 3 },
  conversationTopLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  conversationTitle: { flex: 1, color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  conversationStamp: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  conversationStampUnread: { color: palette.cocoa, fontFamily: type.bold },
  conversationBottomLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  conversationPreview: { flex: 1, color: palette.muted, fontFamily: type.regular, fontSize: 13 },
  conversationPreviewUnread: { color: palette.inkSoft, fontFamily: type.medium },
  conversationPreviewTyping: { color: palette.success, fontFamily: type.semibold },
  conversationBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.rose,
  },
  unreadBadgeMuted: { backgroundColor: palette.muted },
  unreadBadgeText: { color: palette.white, fontFamily: type.bold, fontSize: 11 },

  sheetScrim: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.porcelain,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetReactions: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  sheetReaction: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  sheetReactionActive: { backgroundColor: palette.roseSoft, borderColor: palette.rose },
  sheetReactionEmoji: { fontSize: 22 },
  sheetActions: { gap: 2 },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  sheetActionText: { color: palette.ink, fontFamily: type.semibold, fontSize: 14.5 },
  sheetActionTextDanger: { color: palette.danger },

  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,63,42,0.08)',
    marginBottom: spacing.xs,
  },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 16, textAlign: 'center' },
  emptyBody: { color: palette.muted, fontFamily: type.regular, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
