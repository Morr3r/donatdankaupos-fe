import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { chatService } from '../api/services';
import { syncApplicationBadge } from '../notifications/pushNotifications';
import type {
  ChatAttachmentUpload,
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatSearchHit,
} from '../types/domain';

/**
 * The backend runs on serverless functions, which cannot hold a WebSocket open. Realtime is
 * therefore an adaptive poll over a single delta endpoint, tightened while a room is on screen
 * and suspended entirely in the background where push notifications take over.
 */
const POLL_INTERVAL = {
  room: 2_200,
  list: 11_000,
  idle: 26_000,
} as const;

const CACHE_KEY = 'donat_dankau_chat_cache_v1';
const CACHED_MESSAGES_PER_ROOM = 60;
const TYPING_THROTTLE_MS = 3_500;
const MAX_OUTBOX_ATTEMPTS = 6;

export type ChatPollMode = keyof typeof POLL_INTERVAL;

interface PendingSend {
  clientMessageId: string;
  conversationId: string;
  body: string;
  replyToId?: string | null;
  attachment?: ChatAttachmentUpload | null;
  localImageUri?: string;
  attempts: number;
}

interface ChatState {
  conversations: ChatConversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  hasMoreByConversation: Record<string, boolean>;
  attachmentCache: Record<string, string>;
  outbox: PendingSend[];
  contacts: ChatContact[];
  searchResults: ChatSearchHit[];
  activeConversationId: string | null;
  totalUnread: number;
  cursor: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSearching: boolean;
  hasHydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  loadConversations: () => Promise<void>;
  loadContacts: (query?: string) => Promise<ChatContact[]>;
  openConversation: (conversationId: string) => Promise<void>;
  closeConversation: () => void;
  loadOlder: (conversationId: string) => Promise<void>;
  sync: () => Promise<void>;
  sendMessage: (input: {
    conversationId: string;
    body: string;
    replyToId?: string | null;
    attachment?: ChatAttachmentUpload | null;
    localImageUri?: string;
  }) => Promise<void>;
  flushOutbox: () => Promise<void>;
  retryMessage: (clientMessageId: string) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  markRead: (conversationId: string, seq?: number) => Promise<void>;
  notifyTyping: (conversationId: string) => void;
  setConversationState: (
    conversationId: string,
    payload: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean },
  ) => Promise<void>;
  startConversation: (contact: ChatContact) => Promise<ChatConversation>;
  createGroup: (title: string, memberIds: string[]) => Promise<ChatConversation>;
  addMembers: (conversationId: string, memberIds: string[]) => Promise<void>;
  removeMember: (conversationId: string, userId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  clearHistory: (conversationId: string) => Promise<void>;
  loadAttachment: (attachmentId: string) => Promise<string | null>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  applyPushedMessage: (conversationId: string) => void;
  reset: () => void;
}

export const newClientMessageId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Newest last, deduped by id, with any optimistic twin of a confirmed message removed. */
function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return existing;
  const confirmedClientIds = new Set(
    incoming.map((item) => item.clientMessageId).filter((value): value is string => Boolean(value)),
  );
  const byId = new Map<string, ChatMessage>();
  for (const message of existing) {
    // Drop the local placeholder once the server echoes the real row back.
    if (message.outboxStatus && message.clientMessageId && confirmedClientIds.has(message.clientMessageId)) continue;
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    const previous = byId.get(message.id);
    // Keep the local preview URI so an image does not flicker while its blob downloads.
    byId.set(message.id, previous?.localImageUri ? { ...message, localImageUri: previous.localImageUri } : message);
  }
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

function sortConversations(items: ChatConversation[]): ChatConversation[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const left = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const right = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return right - left;
  });
}

function upsertConversations(
  existing: ChatConversation[],
  incoming: ChatConversation[],
  removedIds: string[] = [],
): ChatConversation[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const conversation of incoming) byId.set(conversation.id, conversation);
  for (const id of removedIds) byId.delete(id);
  return sortConversations([...byId.values()]);
}

function optimisticMessage(pending: PendingSend, senderName: string, senderId: string): ChatMessage {
  return {
    id: `local:${pending.clientMessageId}`,
    conversationId: pending.conversationId,
    // Sorts after everything real until the server assigns the true sequence number.
    seq: Number.MAX_SAFE_INTEGER - MAX_OUTBOX_ATTEMPTS + pending.attempts,
    senderId,
    senderName,
    kind: pending.attachment ? 'image' : 'text',
    body: pending.body,
    clientMessageId: pending.clientMessageId,
    replyTo: null,
    attachment: null,
    reactions: [],
    systemData: {},
    editedAt: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    readByCount: 0,
    isReadByAll: false,
    outboxStatus: 'sending',
    localImageUri: pending.localImageUri,
  };
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollMode: ChatPollMode | null = null;
let inFlightSync: Promise<void> | null = null;
let lastTypingSentAt = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** Identity of the signed-in user, supplied by the bridge so the store stays session-agnostic. */
let viewer: { id: string; name: string } = { id: '', name: 'Saya' };

export function setChatViewer(next: { id: string; name: string }): void {
  viewer = next;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const state = useChatStore.getState();
    const trimmed: Record<string, ChatMessage[]> = {};
    for (const [id, messages] of Object.entries(state.messagesByConversation)) {
      trimmed[id] = messages.filter((item) => !item.outboxStatus).slice(-CACHED_MESSAGES_PER_ROOM);
    }
    // AsyncStorage, not the SecureStore-backed sessionStorage: transcripts exceed its size limit.
    void AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        conversations: state.conversations,
        messagesByConversation: trimmed,
        outbox: state.outbox,
        totalUnread: state.totalUnread,
      }),
    ).catch(() => undefined);
  }, 900);
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversation: {},
  hasMoreByConversation: {},
  attachmentCache: {},
  outbox: [],
  contacts: [],
  searchResults: [],
  activeConversationId: null,
  totalUnread: 0,
  cursor: null,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSearching: false,
  hasHydrated: false,
  error: null,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as Partial<ChatState> & { outbox?: PendingSend[] };
        set({
          conversations: sortConversations(cached.conversations ?? []),
          messagesByConversation: cached.messagesByConversation ?? {},
          outbox: cached.outbox ?? [],
          totalUnread: cached.totalUnread ?? 0,
        });
      }
    } catch {
      // A corrupt cache must never block the screen; the sync below refills it.
    }
    set({ hasHydrated: true });
    await get().loadConversations().catch(() => undefined);
    void get().flushOutbox();
  },

  loadConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const feed = await chatService.conversations();
      set({
        conversations: sortConversations(feed.items),
        totalUnread: feed.totalUnread,
        cursor: feed.cursor,
        isLoadingConversations: false,
      });
      void syncApplicationBadge(feed.totalUnread);
      schedulePersist();
    } catch (error) {
      set({
        isLoadingConversations: false,
        error: error instanceof Error ? error.message : 'Obrolan belum dapat dimuat.',
      });
    }
  },

  loadContacts: async (query) => {
    const response = await chatService.contacts(query);
    set({ contacts: response.items });
    return response.items;
  },

  openConversation: async (conversationId) => {
    set({ activeConversationId: conversationId, isLoadingMessages: true });
    try {
      const page = await chatService.messages(conversationId, { limit: 40 });
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: mergeMessages(state.messagesByConversation[conversationId] ?? [], page.items),
        },
        hasMoreByConversation: { ...state.hasMoreByConversation, [conversationId]: page.hasMoreBefore },
        isLoadingMessages: false,
      }));
      schedulePersist();
      await get().markRead(conversationId);
    } catch (error) {
      set({
        isLoadingMessages: false,
        error: error instanceof Error ? error.message : 'Pesan belum dapat dimuat.',
      });
    }
  },

  closeConversation: () => set({ activeConversationId: null }),

  loadOlder: async (conversationId) => {
    const current = get().messagesByConversation[conversationId] ?? [];
    const oldest = current.find((item) => !item.outboxStatus);
    if (!oldest || get().hasMoreByConversation[conversationId] === false) return;
    const page = await chatService.messages(conversationId, { beforeSeq: oldest.seq, limit: 40 });
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: mergeMessages(state.messagesByConversation[conversationId] ?? [], page.items),
      },
      hasMoreByConversation: { ...state.hasMoreByConversation, [conversationId]: page.hasMoreBefore },
    }));
    schedulePersist();
  },

  sync: async () => {
    // Overlapping polls would fight over the cursor, so a run in progress wins.
    if (inFlightSync) return inFlightSync;
    inFlightSync = (async () => {
      try {
        const result = await chatService.sync(get().cursor);
        const grouped: Record<string, ChatMessage[]> = {};
        for (const message of result.messages) {
          (grouped[message.conversationId] ??= []).push(message);
        }

        set((state) => {
          const next = { ...state.messagesByConversation };
          for (const [conversationId, messages] of Object.entries(grouped)) {
            next[conversationId] = mergeMessages(next[conversationId] ?? [], messages);
          }
          return {
            conversations: upsertConversations(
              state.conversations,
              result.conversations,
              result.removedConversationIds,
            ),
            messagesByConversation: next,
            totalUnread: result.totalUnread,
            cursor: result.cursor,
            error: null,
          };
        });
        void syncApplicationBadge(result.totalUnread);

        // The cursor is time-based, so verify it against each room's authoritative lastSeq and
        // explicitly refetch anything that slipped through rather than silently losing it.
        await Promise.all(
          result.conversations.map(async (conversation) => {
            const known = get().messagesByConversation[conversation.id];
            if (!known?.length) return;
            const newestKnown = known.reduce(
              (highest, item) => (item.outboxStatus ? highest : Math.max(highest, item.seq)),
              0,
            );
            if (conversation.lastSeq <= newestKnown) return;
            const repair = await chatService
              .messages(conversation.id, { afterSeq: newestKnown, limit: 100 })
              .catch(() => null);
            if (!repair?.items.length) return;
            set((state) => ({
              messagesByConversation: {
                ...state.messagesByConversation,
                [conversation.id]: mergeMessages(state.messagesByConversation[conversation.id] ?? [], repair.items),
              },
            }));
          }),
        );

        const active = get().activeConversationId;
        if (active) await get().markRead(active);
        schedulePersist();
      } catch {
        // Offline or a flaky hop: keep the cursor and let the next tick retry.
      } finally {
        inFlightSync = null;
      }
    })();
    return inFlightSync;
  },

  sendMessage: async ({ conversationId, body, replyToId, attachment, localImageUri }) => {
    const pending: PendingSend = {
      clientMessageId: newClientMessageId(),
      conversationId,
      body: body.trim(),
      replyToId: replyToId ?? null,
      attachment: attachment ?? null,
      localImageUri,
      attempts: 0,
    };
    const placeholder = optimisticMessage(pending, viewer.name, viewer.id);
    set((state) => ({
      outbox: [...state.outbox, pending],
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] ?? []), placeholder],
      },
    }));
    await get().flushOutbox();
  },

  flushOutbox: async () => {
    const queue = get().outbox.filter((item) => item.attempts < MAX_OUTBOX_ATTEMPTS);
    if (!queue.length) return;
    for (const pending of queue) {
      try {
        const saved = await chatService.send(pending.conversationId, {
          body: pending.body,
          clientMessageId: pending.clientMessageId,
          replyToId: pending.replyToId,
          attachment: pending.attachment,
        });
        set((state) => ({
          outbox: state.outbox.filter((item) => item.clientMessageId !== pending.clientMessageId),
          messagesByConversation: {
            ...state.messagesByConversation,
            [pending.conversationId]: mergeMessages(
              state.messagesByConversation[pending.conversationId] ?? [],
              [pending.localImageUri ? { ...saved, localImageUri: pending.localImageUri } : saved],
            ),
          },
        }));
      } catch {
        const attempts = pending.attempts + 1;
        set((state) => ({
          outbox: state.outbox.map((item) =>
            item.clientMessageId === pending.clientMessageId ? { ...item, attempts } : item,
          ),
          messagesByConversation: {
            ...state.messagesByConversation,
            [pending.conversationId]: (state.messagesByConversation[pending.conversationId] ?? []).map((item) =>
              item.clientMessageId === pending.clientMessageId
                ? { ...item, outboxStatus: 'failed' as const }
                : item,
            ),
          },
        }));
        // Stop on the first failure: the network is down, so the rest will fail too.
        break;
      }
    }
    set((state) => ({ conversations: state.conversations }));
    void get().loadConversations();
    schedulePersist();
  },

  retryMessage: async (clientMessageId) => {
    const pending = get().outbox.find((item) => item.clientMessageId === clientMessageId);
    if (!pending) return;
    set((state) => ({
      outbox: state.outbox.map((item) =>
        item.clientMessageId === clientMessageId ? { ...item, attempts: 0 } : item,
      ),
      messagesByConversation: {
        ...state.messagesByConversation,
        [pending.conversationId]: (state.messagesByConversation[pending.conversationId] ?? []).map((item) =>
          item.clientMessageId === clientMessageId ? { ...item, outboxStatus: 'sending' as const } : item,
        ),
      },
    }));
    await get().flushOutbox();
  },

  editMessage: async (messageId, body) => {
    const saved = await chatService.edit(messageId, body);
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [saved.conversationId]: mergeMessages(state.messagesByConversation[saved.conversationId] ?? [], [saved]),
      },
    }));
    schedulePersist();
  },

  deleteMessage: async (messageId) => {
    const saved = await chatService.remove(messageId);
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [saved.conversationId]: mergeMessages(state.messagesByConversation[saved.conversationId] ?? [], [saved]),
      },
    }));
    schedulePersist();
  },

  reactToMessage: async (messageId, emoji) => {
    const saved = await chatService.react(messageId, emoji);
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [saved.conversationId]: mergeMessages(state.messagesByConversation[saved.conversationId] ?? [], [saved]),
      },
    }));
    schedulePersist();
  },

  markRead: async (conversationId, seq) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const target = seq ?? conversation?.lastSeq ?? 0;
    if (conversation && conversation.lastReadSeq >= target && conversation.unreadCount === 0) return;
    // Paint the badge immediately; the request only confirms it.
    set((state) => {
      const nextConversations = state.conversations.map((item) =>
        item.id === conversationId
          ? { ...item, unreadCount: 0, lastReadSeq: Math.max(item.lastReadSeq, target) }
          : item,
      );
      return {
        conversations: nextConversations,
        totalUnread: nextConversations.reduce(
          (total, item) => total + (item.isArchived ? 0 : item.unreadCount),
          0,
        ),
      };
    });
    void syncApplicationBadge(get().totalUnread);
    try {
      const saved = await chatService.markRead(conversationId, target);
      set((state) => ({ conversations: upsertConversations(state.conversations, [saved]) }));
    } catch {
      // The optimistic clear stands; the next sync reconciles the true count.
    }
  },

  notifyTyping: (conversationId) => {
    const now = Date.now();
    if (now - lastTypingSentAt < TYPING_THROTTLE_MS) return;
    lastTypingSentAt = now;
    void chatService.setTyping(conversationId).catch(() => undefined);
  },

  setConversationState: async (conversationId, payload) => {
    set((state) => ({
      conversations: state.conversations.map((item) =>
        item.id === conversationId ? { ...item, ...payload } : item,
      ),
    }));
    try {
      const saved = await chatService.setState(conversationId, payload);
      set((state) => ({ conversations: upsertConversations(state.conversations, [saved]) }));
      schedulePersist();
    } catch {
      await get().loadConversations();
    }
  },

  startConversation: async (contact) => {
    const conversation = await chatService.createConversation({ kind: 'direct', memberIds: [contact.id] });
    set((state) => ({ conversations: upsertConversations(state.conversations, [conversation]) }));
    schedulePersist();
    return conversation;
  },

  createGroup: async (title, memberIds) => {
    const conversation = await chatService.createConversation({ kind: 'group', title, memberIds });
    set((state) => ({ conversations: upsertConversations(state.conversations, [conversation]) }));
    schedulePersist();
    return conversation;
  },

  addMembers: async (conversationId, memberIds) => {
    const conversation = await chatService.addMembers(conversationId, memberIds);
    set((state) => ({ conversations: upsertConversations(state.conversations, [conversation]) }));
  },

  removeMember: async (conversationId, userId) => {
    await chatService.removeMember(conversationId, userId);
    const conversation = await chatService.conversation(conversationId);
    set((state) => ({ conversations: upsertConversations(state.conversations, [conversation]) }));
  },

  leaveConversation: async (conversationId) => {
    await chatService.leave(conversationId);
    set((state) => ({
      conversations: state.conversations.filter((item) => item.id !== conversationId),
      activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
    }));
    schedulePersist();
  },

  renameConversation: async (conversationId, title) => {
    const conversation = await chatService.updateConversation(conversationId, { title });
    set((state) => ({ conversations: upsertConversations(state.conversations, [conversation]) }));
  },

  clearHistory: async (conversationId) => {
    await chatService.clearHistory(conversationId);
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: [] },
      hasMoreByConversation: { ...state.hasMoreByConversation, [conversationId]: false },
    }));
    schedulePersist();
  },

  loadAttachment: async (attachmentId) => {
    const cached = get().attachmentCache[attachmentId];
    if (cached) return cached;
    try {
      const payload = await chatService.attachment(attachmentId);
      set((state) => ({ attachmentCache: { ...state.attachmentCache, [attachmentId]: payload.data } }));
      return payload.data;
    } catch {
      return null;
    }
  },

  search: async (query) => {
    if (query.trim().length < 2) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const response = await chatService.search(query.trim());
      set({ searchResults: response.items, isSearching: false });
    } catch {
      set({ searchResults: [], isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], isSearching: false }),

  applyPushedMessage: (conversationId) => {
    // A push landed while the app was foregrounded: pull the delta now instead of waiting.
    void get().sync();
    if (get().activeConversationId === conversationId) void get().markRead(conversationId);
  },

  reset: () => {
    stopChatPolling();
    void AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
    set({
      conversations: [],
      messagesByConversation: {},
      hasMoreByConversation: {},
      attachmentCache: {},
      outbox: [],
      contacts: [],
      searchResults: [],
      activeConversationId: null,
      totalUnread: 0,
      cursor: null,
      isLoadingConversations: false,
      isLoadingMessages: false,
      isSearching: false,
      hasHydrated: false,
      error: null,
    });
  },
}));

export function startChatPolling(mode: ChatPollMode): void {
  if (pollMode === mode && pollTimer) return;
  stopChatPolling();
  pollMode = mode;
  void useChatStore.getState().sync();
  pollTimer = setInterval(() => {
    void useChatStore.getState().sync();
  }, POLL_INTERVAL[mode]);
}

export function stopChatPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  pollMode = null;
}

export const selectConversation = (conversationId: string | undefined) => (state: ChatState) =>
  conversationId ? state.conversations.find((item) => item.id === conversationId) : undefined;

export const selectMessages = (conversationId: string | undefined) => (state: ChatState) =>
  conversationId ? state.messagesByConversation[conversationId] : undefined;
