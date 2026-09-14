import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Eraser,
  LogOut,
  Pencil,
  Pin,
  PinOff,
  UserMinus,
  UserPlus,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatAvatar } from '../components/chat';
import { AppBackground, Button, FormModal, GlassCard, Header, ScalePressable } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useChatStore } from '../store/chatStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ChatContact } from '../types/domain';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ChatInfo'>;

const roleLabels: Record<ChatContact['role'], string> = {
  owner: 'Owner',
  manager: 'Manajer',
  cashier: 'Kasir',
  staff: 'Staf',
};

export function ChatInfoScreen() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const conversationId = params.conversationId;

  const currentUser = useSessionStore((state) => state.user);
  const conversation = useChatStore((state) =>
    state.conversations.find((item) => item.id === conversationId),
  );
  const setConversationState = useChatStore((state) => state.setConversationState);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const leaveConversation = useChatStore((state) => state.leaveConversation);
  const removeMember = useChatStore((state) => state.removeMember);
  const addMembers = useChatStore((state) => state.addMembers);
  const clearHistory = useChatStore((state) => state.clearHistory);
  const loadContacts = useChatStore((state) => state.loadContacts);

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation?.title ?? '');
  const [isAdding, setIsAdding] = useState(false);
  const [candidates, setCandidates] = useState<ChatContact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const isGroup = conversation?.kind === 'group';
  const isAdmin = conversation?.myMemberRole === 'admin';

  const members = useMemo(
    () => (conversation?.members ?? []).filter((member) => !member.leftAt),
    [conversation?.members],
  );
  const memberIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);

  const openAddMembers = useCallback(async () => {
    setIsAdding(true);
    setSelected([]);
    try {
      const contacts = await loadContacts();
      setCandidates(contacts.filter((contact) => !memberIds.has(contact.id)));
    } catch {
      setCandidates([]);
    }
  }, [loadContacts, memberIds]);

  const submitRename = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title) return;
    setIsBusy(true);
    try {
      await renameConversation(conversationId, title);
      setIsRenaming(false);
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Nama grup belum dapat diubah.');
    } finally {
      setIsBusy(false);
    }
  }, [conversationId, draftTitle, renameConversation]);

  const submitAddMembers = useCallback(async () => {
    if (!selected.length) return;
    setIsBusy(true);
    try {
      await addMembers(conversationId, selected);
      setIsAdding(false);
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Anggota belum dapat ditambahkan.');
    } finally {
      setIsBusy(false);
    }
  }, [addMembers, conversationId, selected]);

  const confirmLeave = useCallback(() => {
    Alert.alert('Keluar dari grup?', 'Anda tidak akan menerima pesan baru dari grup ini.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          void leaveConversation(conversationId)
            .then(() => navigation.navigate('MainTabs', { screen: 'Chat' }))
            .catch((error: unknown) =>
              Alert.alert('Gagal', error instanceof Error ? error.message : 'Gagal keluar dari grup.'),
            );
        },
      },
    ]);
  }, [conversationId, leaveConversation, navigation]);

  const confirmClear = useCallback(() => {
    Alert.alert('Bersihkan obrolan?', 'Riwayat akan hilang untuk Anda saja. Anggota lain tetap melihatnya.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Bersihkan',
        style: 'destructive',
        onPress: () => void clearHistory(conversationId).catch(() => undefined),
      },
    ]);
  }, [clearHistory, conversationId]);

  const confirmRemove = useCallback(
    (userId: string, name: string) => {
      Alert.alert('Keluarkan anggota?', `${name} akan dikeluarkan dari grup ini.`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluarkan',
          style: 'destructive',
          onPress: () =>
            void removeMember(conversationId, userId).catch((error: unknown) =>
              Alert.alert('Gagal', error instanceof Error ? error.message : 'Anggota gagal dikeluarkan.'),
            ),
        },
      ]);
    },
    [conversationId, removeMember],
  );

  if (!conversation) {
    return (
      <AppBackground>
        <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
          <Header onBack={() => navigation.goBack()} title="Info obrolan" />
          <Text style={styles.emptyNote}>Percakapan tidak ditemukan.</Text>
        </View>
      </AppBackground>
    );
  }

  const toggles = [
    {
      label: conversation.isMuted ? 'Bunyikan notifikasi' : 'Bisukan notifikasi',
      hint: conversation.isMuted ? 'Push aktif untuk obrolan ini' : 'Tidak ada push dari obrolan ini',
      icon: conversation.isMuted ? Bell : BellOff,
      run: () => setConversationState(conversationId, { isMuted: !conversation.isMuted }),
    },
    {
      label: conversation.isPinned ? 'Lepas sematan' : 'Sematkan ke atas',
      hint: 'Obrolan tersemat selalu tampil paling atas',
      icon: conversation.isPinned ? PinOff : Pin,
      run: () => setConversationState(conversationId, { isPinned: !conversation.isPinned }),
    },
    {
      label: conversation.isArchived ? 'Keluarkan dari arsip' : 'Arsipkan obrolan',
      hint: 'Arsip menyembunyikan obrolan dari daftar utama',
      icon: conversation.isArchived ? ArchiveRestore : Archive,
      run: () => setConversationState(conversationId, { isArchived: !conversation.isArchived }),
    },
  ];

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header onBack={() => navigation.goBack()} title="Info obrolan" />

        <View style={styles.identity}>
          <ChatAvatar
            accent={conversation.accent}
            initials={conversation.initials}
            isGroup={isGroup}
            isOnline={conversation.isOnline}
            size={92}
          />
          <View style={styles.identityCopy}>
            <Text style={styles.identityTitle}>{conversation.title}</Text>
            <Text style={styles.identitySubtitle}>{conversation.subtitle}</Text>
          </View>
          {isGroup && isAdmin ? (
            <ScalePressable
              accessibilityLabel="Ubah nama grup"
              onPress={() => {
                setDraftTitle(conversation.title);
                setIsRenaming(true);
              }}
              style={styles.renameButton}
            >
              <Pencil color={palette.cocoa} size={17} strokeWidth={2.1} />
              <Text style={styles.renameButtonText}>Ubah nama</Text>
            </ScalePressable>
          ) : null}
        </View>

        <GlassCard style={styles.card}>
          {toggles.map(({ label, hint, icon: Icon, run }) => (
            <ScalePressable accessibilityLabel={label} key={label} onPress={() => void run()} style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Icon color={palette.cocoaDark} size={19} strokeWidth={2.1} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingHint}>{hint}</Text>
              </View>
            </ScalePressable>
          ))}
        </GlassCard>

        {isGroup ? (
          <GlassCard style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{members.length} anggota</Text>
              {isAdmin ? (
                <ScalePressable
                  accessibilityLabel="Tambah anggota"
                  onPress={() => void openAddMembers()}
                  style={styles.addMemberButton}
                >
                  <UserPlus color={palette.cocoa} size={16} strokeWidth={2.2} />
                  <Text style={styles.addMemberText}>Tambah</Text>
                </ScalePressable>
              ) : null}
            </View>
            {members.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <ChatAvatar
                  accent={member.accent}
                  initials={member.initials}
                  isOnline={member.isOnline}
                  size={42}
                />
                <View style={styles.memberCopy}>
                  <Text numberOfLines={1} style={styles.memberName}>
                    {member.name}
                    {member.userId === currentUser?.id ? ' (Anda)' : ''}
                  </Text>
                  <Text numberOfLines={1} style={styles.memberMeta}>
                    {roleLabels[member.role]}
                    {member.outletName ? ` · ${member.outletName}` : ''}
                    {member.memberRole === 'admin' ? ' · Admin grup' : ''}
                  </Text>
                </View>
                {isAdmin && member.userId !== currentUser?.id ? (
                  <ScalePressable
                    accessibilityLabel={`Keluarkan ${member.name}`}
                    onPress={() => confirmRemove(member.userId, member.name)}
                    style={styles.removeMemberButton}
                  >
                    <UserMinus color={palette.danger} size={17} strokeWidth={2.1} />
                  </ScalePressable>
                ) : null}
              </View>
            ))}
          </GlassCard>
        ) : null}

        <GlassCard style={styles.card}>
          <ScalePressable accessibilityLabel="Bersihkan obrolan" onPress={confirmClear} style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Eraser color={palette.cocoaDark} size={19} strokeWidth={2.1} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingLabel}>Bersihkan obrolan</Text>
              <Text style={styles.settingHint}>Hanya menghapus riwayat di perangkat Anda</Text>
            </View>
          </ScalePressable>
          {isGroup ? (
            <ScalePressable accessibilityLabel="Keluar dari grup" onPress={confirmLeave} style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <LogOut color={palette.danger} size={19} strokeWidth={2.1} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={[styles.settingLabel, styles.settingLabelDanger]}>Keluar dari grup</Text>
                <Text style={styles.settingHint}>Anda berhenti menerima pesan grup ini</Text>
              </View>
            </ScalePressable>
          ) : null}
        </GlassCard>
      </ScrollView>

      <FormModal
        footer={
          <Button
            disabled={!draftTitle.trim()}
            label="Simpan nama"
            loading={isBusy}
            onPress={() => void submitRename()}
          />
        }
        onClose={() => setIsRenaming(false)}
        title="Ubah nama grup"
        visible={isRenaming}
      >
        <TextInput
          accessibilityLabel="Nama grup"
          maxLength={120}
          onChangeText={setDraftTitle}
          placeholder="Nama grup"
          placeholderTextColor={palette.muted}
          style={styles.modalInput}
          value={draftTitle}
        />
      </FormModal>

      <FormModal
        footer={
          <Button
            disabled={!selected.length}
            label={`Tambahkan (${selected.length})`}
            loading={isBusy}
            onPress={() => void submitAddMembers()}
          />
        }
        onClose={() => setIsAdding(false)}
        subtitle="Pilih rekan dari outlet mana pun"
        title="Tambah anggota"
        visible={isAdding}
      >
        {candidates.length === 0 ? (
          <Text style={styles.emptyNote}>Semua rekan sudah menjadi anggota grup ini.</Text>
        ) : (
          candidates.map((contact) => {
            const isSelected = selected.includes(contact.id);
            return (
              <ScalePressable
                accessibilityLabel={contact.name}
                accessibilityState={{ selected: isSelected }}
                key={contact.id}
                onPress={() =>
                  setSelected((current) =>
                    current.includes(contact.id)
                      ? current.filter((id) => id !== contact.id)
                      : [...current, contact.id],
                  )
                }
                style={[styles.candidateRow, isSelected && styles.candidateRowSelected]}
              >
                <ChatAvatar accent={contact.accent} initials={contact.initials} size={38} />
                <View style={styles.memberCopy}>
                  <Text numberOfLines={1} style={styles.memberName}>{contact.name}</Text>
                  <Text numberOfLines={1} style={styles.memberMeta}>
                    {roleLabels[contact.role]} · {contact.outletName}
                  </Text>
                </View>
              </ScalePressable>
            );
          })
        )}
      </FormModal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, gap: spacing.sm },
  identity: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  identityCopy: { alignItems: 'center', gap: 2 },
  identityTitle: { color: palette.ink, fontFamily: type.display, fontSize: 23, textAlign: 'center' },
  identitySubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 13, textAlign: 'center' },
  renameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  renameButtonText: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 12.5 },
  card: { padding: spacing.xs, gap: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, borderRadius: radius.sm },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,63,42,0.07)',
  },
  settingCopy: { flex: 1, gap: 1 },
  settingLabel: { color: palette.ink, fontFamily: type.semibold, fontSize: 14 },
  settingLabelDanger: { color: palette.danger },
  settingHint: { color: palette.muted, fontFamily: type.regular, fontSize: 11.5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  sectionTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  addMemberButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addMemberText: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 12.5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs },
  memberCopy: { flex: 1, gap: 2 },
  memberName: { color: palette.ink, fontFamily: type.semibold, fontSize: 14 },
  memberMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 11.5 },
  removeMemberButton: { padding: 7 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  candidateRowSelected: { backgroundColor: palette.roseSoft, borderColor: palette.rose },
  modalInput: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.sm,
    height: 48,
    color: palette.ink,
    fontFamily: type.regular,
    fontSize: 14.5,
  },
  emptyNote: { color: palette.muted, fontFamily: type.regular, fontSize: 13, textAlign: 'center', padding: spacing.md },
});
