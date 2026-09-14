import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Archive, ArchiveRestore, BellOff, Bell, MessageSquarePlus, Pin, PinOff, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChatAvatar,
  ConversationRow,
  EmptyChatState,
  formatListStamp,
  previewText,
} from '../components/chat';
import { AppBackground, ScalePressable } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useChatStore } from '../store/chatStore';
import { palette, radius, shadow, spacing, type } from '../theme/tokens';
import type { ChatConversation } from '../types/domain';
import { useResponsiveLayout } from '../utils/responsive';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function ChatListScreen() {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const { isLandscapePhone } = useResponsiveLayout();

  const conversations = useChatStore((state) => state.conversations);
  const isLoading = useChatStore((state) => state.isLoadingConversations);
  const error = useChatStore((state) => state.error);
  const totalUnread = useChatStore((state) => state.totalUnread);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const setConversationState = useChatStore((state) => state.setConversationState);
  const searchResults = useChatStore((state) => state.searchResults);
  const isSearching = useChatStore((state) => state.isSearching);
  const search = useChatStore((state) => state.search);
  const clearSearch = useChatStore((state) => state.clearSearch);

  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [actionTarget, setActionTarget] = useState<ChatConversation | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (query.trim().length >= 2) void search(query);
      else clearSearch();
    }, 280);
    return () => clearTimeout(handle);
  }, [clearSearch, query, search]);

  const visible = useMemo(() => {
    const scoped = conversations.filter((item) => item.isArchived === showArchived);
    if (query.trim().length < 2) return scoped;
    const term = query.trim().toLowerCase();
    return scoped.filter((item) => item.title.toLowerCase().includes(term));
  }, [conversations, query, showArchived]);

  const archivedCount = useMemo(
    () => conversations.filter((item) => item.isArchived).length,
    [conversations],
  );

  const openRoom = useCallback(
    (conversationId: string) => navigation.navigate('ChatRoom', { conversationId }),
    [navigation],
  );

  const searching = query.trim().length >= 2;

  return (
    <AppBackground>
      <View style={[styles.container, { paddingTop: insets.top + (isLandscapePhone ? spacing.xxs : spacing.xs) }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Donat Dankau</Text>
            <Text accessibilityRole="header" style={styles.title}>Obrolan</Text>
            <Text style={styles.subtitle}>
              {totalUnread > 0 ? `${totalUnread} pesan belum dibaca` : 'Semua pesan sudah terbaca'}
            </Text>
          </View>
          <ScalePressable
            accessibilityHint="Memilih rekan untuk memulai percakapan"
            accessibilityLabel="Mulai obrolan baru"
            onPress={() => navigation.navigate('NewChat')}
            style={styles.newChatButton}
          >
            <MessageSquarePlus color={palette.white} size={21} strokeWidth={2.2} />
          </ScalePressable>
        </View>

        <View style={styles.searchField}>
          <Search color={palette.muted} size={18} strokeWidth={2} />
          <TextInput
            accessibilityLabel="Cari obrolan atau pesan"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Cari nama atau isi pesan"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <ScalePressable accessibilityLabel="Bersihkan pencarian" onPress={() => setQuery('')}>
              <X color={palette.muted} size={17} strokeWidth={2.2} />
            </ScalePressable>
          ) : null}
        </View>

        {(showArchived || archivedCount > 0) && !searching ? (
          <ScalePressable
            accessibilityLabel={showArchived ? 'Kembali ke obrolan aktif' : `Lihat ${archivedCount} obrolan diarsipkan`}
            onPress={() => setShowArchived((current) => !current)}
            style={styles.archiveToggle}
          >
            {showArchived ? (
              <ArchiveRestore color={palette.cocoa} size={17} strokeWidth={2.1} />
            ) : (
              <Archive color={palette.cocoa} size={17} strokeWidth={2.1} />
            )}
            <Text style={styles.archiveToggleText}>
              {showArchived ? 'Kembali ke obrolan aktif' : `Diarsipkan (${archivedCount})`}
            </Text>
          </ScalePressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {searching ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={searchResults}
            keyExtractor={(item) => item.message.id}
            ListEmptyComponent={
              isSearching ? (
                <ActivityIndicator color={palette.cocoa} style={styles.searchSpinner} />
              ) : (
                <EmptyChatState
                  body={`Tidak ada pesan yang cocok dengan “${query.trim()}”.`}
                  icon={Search}
                  title="Tidak ditemukan"
                />
              )
            }
            ListHeaderComponent={
              visible.length ? (
                <View>
                  <Text style={styles.sectionLabel}>Obrolan</Text>
                  {visible.map((conversation) => (
                    <ConversationRow
                      conversation={conversation}
                      key={conversation.id}
                      onLongPress={() => setActionTarget(conversation)}
                      onPress={() => openRoom(conversation.id)}
                    />
                  ))}
                  <Text style={styles.sectionLabel}>Pesan</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={`Pesan dari ${item.message.senderName} di ${item.conversationTitle}`}
                accessibilityRole="button"
                onPress={() => openRoom(item.conversationId)}
                style={({ pressed }) => [styles.searchHit, pressed && styles.searchHitPressed]}
              >
                <ChatAvatar accent={item.accent} initials={item.initials} size={42} />
                <View style={styles.searchHitCopy}>
                  <View style={styles.searchHitTop}>
                    <Text numberOfLines={1} style={styles.searchHitTitle}>{item.conversationTitle}</Text>
                    <Text style={styles.searchHitStamp}>{formatListStamp(item.message.createdAt)}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.searchHitBody}>
                    {item.message.senderName}: {previewText(item.message)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + (isLandscapePhone ? 76 : 116) },
            ]}
            data={visible}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              isLoading ? (
                <ActivityIndicator color={palette.cocoa} style={styles.searchSpinner} />
              ) : (
                <EmptyChatState
                  body={
                    showArchived
                      ? 'Obrolan yang Anda arsipkan akan muncul di sini.'
                      : 'Mulai percakapan pertama dengan rekan satu tim lewat tombol di kanan atas.'
                  }
                  icon={MessageSquarePlus}
                  title={showArchived ? 'Arsip kosong' : 'Belum ada obrolan'}
                />
              )
            }
            refreshControl={
              <RefreshControl
                onRefresh={() => void loadConversations()}
                refreshing={isLoading && visible.length > 0}
                tintColor={palette.cocoa}
              />
            }
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                onLongPress={() => setActionTarget(item)}
                onPress={() => openRoom(item.id)}
              />
            )}
          />
        )}

        {actionTarget ? (
          <Pressable
            accessibilityLabel="Tutup menu obrolan"
            onPress={() => setActionTarget(null)}
            style={styles.scrim}
          >
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{actionTarget.title}</Text>
              {[
                {
                  label: actionTarget.isPinned ? 'Lepas sematan' : 'Sematkan ke atas',
                  icon: actionTarget.isPinned ? PinOff : Pin,
                  run: () => setConversationState(actionTarget.id, { isPinned: !actionTarget.isPinned }),
                },
                {
                  label: actionTarget.isMuted ? 'Bunyikan notifikasi' : 'Bisukan notifikasi',
                  icon: actionTarget.isMuted ? Bell : BellOff,
                  run: () => setConversationState(actionTarget.id, { isMuted: !actionTarget.isMuted }),
                },
                {
                  label: actionTarget.isArchived ? 'Keluarkan dari arsip' : 'Arsipkan obrolan',
                  icon: actionTarget.isArchived ? ArchiveRestore : Archive,
                  run: () => setConversationState(actionTarget.id, { isArchived: !actionTarget.isArchived }),
                },
              ].map(({ label, icon: Icon, run }) => (
                <ScalePressable
                  accessibilityLabel={label}
                  key={label}
                  onPress={() => {
                    void run();
                    setActionTarget(null);
                  }}
                  style={styles.sheetAction}
                >
                  <Icon color={palette.cocoaDark} size={19} strokeWidth={2.1} />
                  <Text style={styles.sheetActionText}>{label}</Text>
                </ScalePressable>
              ))}
            </View>
          </Pressable>
        ) : null}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: palette.rose,
    fontFamily: type.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: { color: palette.ink, fontFamily: type.display, fontSize: 28, marginTop: 1 },
  subtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 12.5, marginTop: 1 },
  newChatButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cocoa,
    ...shadow.floating,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.sm,
    height: 44,
    marginBottom: spacing.xs,
  },
  searchInput: { flex: 1, color: palette.ink, fontFamily: type.regular, fontSize: 14 },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  archiveToggleText: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 13 },
  error: {
    color: palette.danger,
    fontFamily: type.medium,
    fontSize: 12.5,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  listContent: { paddingBottom: spacing.xxl },
  sectionLabel: {
    color: palette.muted,
    fontFamily: type.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
  },
  searchSpinner: { marginTop: spacing.xl },
  searchHit: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  searchHitPressed: { backgroundColor: 'rgba(107,63,42,0.06)' },
  searchHitCopy: { flex: 1, gap: 2 },
  searchHitTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  searchHitTitle: { flex: 1, color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  searchHitStamp: { color: palette.muted, fontFamily: type.medium, fontSize: 10.5 },
  searchHitBody: { color: palette.muted, fontFamily: type.regular, fontSize: 12.5, lineHeight: 17 },

  scrim: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.porcelain,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: 2,
  },
  sheetTitle: {
    color: palette.ink,
    fontFamily: type.bold,
    fontSize: 15,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  sheetActionText: { color: palette.ink, fontFamily: type.semibold, fontSize: 14.5 },
});
