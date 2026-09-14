import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Search, UserPlus, Users, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatAvatar, EmptyChatState } from '../components/chat';
import { AppBackground, Button, ScalePressable } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useChatStore } from '../store/chatStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ChatContact } from '../types/domain';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const roleLabels: Record<ChatContact['role'], string> = {
  owner: 'Owner',
  manager: 'Manajer',
  cashier: 'Kasir',
  staff: 'Staf',
};

export function NewChatScreen() {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const loadContacts = useChatStore((state) => state.loadContacts);
  const startConversation = useChatStore((state) => state.startConversation);
  const createGroup = useChatStore((state) => state.createGroup);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void loadContacts()
      .then((items) => {
        if (!cancelled) setContacts(items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadContacts]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(term) || contact.outletName.toLowerCase().includes(term),
    );
  }, [contacts, query]);

  // Contacts span every outlet, so grouping by outlet keeps a long directory scannable.
  const sections = useMemo(() => {
    const grouped = new Map<string, ChatContact[]>();
    for (const contact of filtered) {
      const key = contact.outletName || 'Tanpa outlet';
      grouped.set(key, [...(grouped.get(key) ?? []), contact]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filtered]);

  const openDirect = useCallback(
    async (contact: ChatContact) => {
      setIsSubmitting(true);
      try {
        const conversation = await startConversation(contact);
        navigation.replace('ChatRoom', { conversationId: conversation.id });
      } catch (error) {
        Alert.alert('Gagal', error instanceof Error ? error.message : 'Obrolan belum dapat dibuat.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigation, startConversation],
  );

  const submitGroup = useCallback(async () => {
    const title = groupTitle.trim();
    if (!title) {
      Alert.alert('Nama grup kosong', 'Beri nama grup terlebih dahulu.');
      return;
    }
    if (!selected.length) {
      Alert.alert('Belum ada anggota', 'Pilih minimal satu rekan untuk masuk ke grup.');
      return;
    }
    setIsSubmitting(true);
    try {
      const conversation = await createGroup(title, selected);
      navigation.replace('ChatRoom', { conversationId: conversation.id });
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Grup belum dapat dibuat.');
    } finally {
      setIsSubmitting(false);
    }
  }, [createGroup, groupTitle, navigation, selected]);

  const toggle = useCallback((contactId: string) => {
    setSelected((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId],
    );
  }, []);

  return (
    <AppBackground>
      <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.header}>
          <ScalePressable accessibilityLabel="Tutup" onPress={() => navigation.goBack()} style={styles.iconButton}>
            <X color={palette.cocoaDark} size={22} strokeWidth={2.2} />
          </ScalePressable>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              {isGroupMode ? 'Grup baru' : 'Obrolan baru'}
            </Text>
            <Text style={styles.subtitle}>
              {isGroupMode
                ? `${selected.length} anggota dipilih`
                : `${contacts.length} rekan tersedia di semua outlet`}
            </Text>
          </View>
          <ScalePressable
            accessibilityLabel={isGroupMode ? 'Kembali ke obrolan pribadi' : 'Buat grup'}
            onPress={() => {
              setIsGroupMode((current) => !current);
              setSelected([]);
              setGroupTitle('');
            }}
            style={[styles.iconButton, isGroupMode && styles.iconButtonActive]}
          >
            <Users color={isGroupMode ? palette.white : palette.cocoaDark} size={20} strokeWidth={2.1} />
          </ScalePressable>
        </View>

        {isGroupMode ? (
          <TextInput
            accessibilityLabel="Nama grup"
            maxLength={120}
            onChangeText={setGroupTitle}
            placeholder="Nama grup, misal: Tim Produksi Pagi"
            placeholderTextColor={palette.muted}
            style={styles.groupTitleInput}
            value={groupTitle}
          />
        ) : null}

        <View style={styles.searchField}>
          <Search color={palette.muted} size={18} strokeWidth={2} />
          <TextInput
            accessibilityLabel="Cari rekan"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Cari nama atau outlet"
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            value={query}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={palette.cocoa} style={styles.spinner} />
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: insets.bottom + (isGroupMode ? 120 : 40) }}
            data={sections}
            keyExtractor={([outletName]) => outletName}
            ListEmptyComponent={
              <EmptyChatState
                body="Tidak ada rekan yang cocok dengan pencarian Anda."
                icon={UserPlus}
                title="Tidak ditemukan"
              />
            }
            renderItem={({ item: [outletName, members] }) => (
              <View>
                <Text style={styles.sectionLabel}>{outletName}</Text>
                {members.map((contact) => {
                  const isSelected = selected.includes(contact.id);
                  return (
                    <Pressable
                      accessibilityLabel={`${contact.name}, ${roleLabels[contact.role]} di ${contact.outletName}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isGroupMode ? isSelected : undefined }}
                      key={contact.id}
                      onPress={() => (isGroupMode ? toggle(contact.id) : void openDirect(contact))}
                      style={({ pressed }) => [styles.contactRow, pressed && styles.contactRowPressed]}
                    >
                      <ChatAvatar
                        accent={contact.accent}
                        avatarUpdatedAt={contact.avatarUpdatedAt}
                        initials={contact.initials}
                        isOnline={contact.isOnline}
                        size={46}
                        userId={contact.id}
                      />
                      <View style={styles.contactCopy}>
                        <Text numberOfLines={1} style={styles.contactName}>{contact.name}</Text>
                        <Text numberOfLines={1} style={styles.contactMeta}>
                          {roleLabels[contact.role]}
                          {contact.isOnline ? ' · online' : ''}
                          {contact.conversationId && !isGroupMode ? ' · sudah ada obrolan' : ''}
                        </Text>
                      </View>
                      {isGroupMode ? (
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected ? <Check color={palette.white} size={15} strokeWidth={3} /> : null}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        )}

        {isGroupMode ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <Button
              disabled={!selected.length || !groupTitle.trim()}
              icon={Users}
              label={`Buat grup (${selected.length})`}
              loading={isSubmitting}
              onPress={() => void submitGroup()}
            />
          </View>
        ) : null}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  headerCopy: { flex: 1 },
  title: { color: palette.ink, fontFamily: type.display, fontSize: 22 },
  subtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 12, marginTop: 1 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  iconButtonActive: { backgroundColor: palette.cocoa, borderColor: palette.cocoa },
  groupTitleInput: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.sm,
    height: 48,
    color: palette.ink,
    fontFamily: type.semibold,
    fontSize: 14.5,
    marginBottom: spacing.xs,
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
  spinner: { marginTop: spacing.xl },
  sectionLabel: {
    color: palette.muted,
    fontFamily: type.bold,
    fontSize: 10.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  contactRowPressed: { backgroundColor: 'rgba(107,63,42,0.06)' },
  contactCopy: { flex: 1, gap: 2 },
  contactName: { color: palette.ink, fontFamily: type.semibold, fontSize: 14.5 },
  contactMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: palette.cocoa, borderColor: palette.cocoa },
  footer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(255,249,242,0.97)',
  },
});
