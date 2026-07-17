import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { createElement, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { palette, radius, spacing, type } from '../theme/tokens';
import {
  dateRangeDayCount,
  type DateRangeMode,
  type DateRangeSelection,
  formatRangeLabel,
  fromDateParam,
  makeDateRange,
  shiftDateRange,
  startOfDay,
  toDateParam,
} from '../utils/date';
import { Button, FormModal, GlassCard, ScalePressable } from './ui';

const modes: { id: DateRangeMode; label: string }[] = [
  { id: 'day', label: 'Hari' },
  { id: 'month', label: 'Bulan' },
  { id: 'year', label: 'Tahun' },
  { id: 'custom', label: 'Rentang' },
];

type PickerTarget = 'anchor' | 'from' | 'to';

export function DateRangePicker({ value, onChange }: { value: DateRangeSelection; onChange: (value: DateRangeSelection) => void }) {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  useEffect(() => setDraft(value), [value]);

  const changeMode = (mode: DateRangeMode) => {
    const next = makeDateRange(mode, value.anchor, value.from, value.to);
    onChange(next);
  };

  const updateDraftDate = (target: PickerTarget, selected: Date) => {
    if (target === 'anchor') {
      setDraft(makeDateRange(draft.mode, selected, draft.from, draft.to));
      return;
    }
    const nextFrom = target === 'from' ? selected : draft.from;
    const nextTo = target === 'to' ? selected : draft.to;
    setDraft(makeDateRange('custom', draft.anchor, nextFrom, nextTo));
  };

  const openEditor = () => {
    setDraft(value);
    setPickerTarget(null);
    setOpen(true);
  };

  const movePeriod = (direction: -1 | 1) => onChange(shiftDateRange(value, direction));
  const today = startOfDay(new Date());
  const canMoveNext = startOfDay(value.to) < today;
  const draftDayCount = dateRangeDayCount(draft);
  const invalidDraft = draftDayCount > 366;
  const compact = width < 390;

  return (
    <View style={styles.container}>
      <View style={styles.modes}>
        {modes.map((mode) => (
          <ScalePressable
            key={mode.id}
            accessibilityLabel={`Periode ${mode.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: value.mode === mode.id }}
            containerStyle={styles.modeCell}
            onPress={() => changeMode(mode.id)}
            style={[styles.modeButton, value.mode === mode.id && styles.modeButtonSelected]}
          >
            <Text style={[styles.modeText, value.mode === mode.id && styles.modeTextSelected]}>{mode.label}</Text>
          </ScalePressable>
        ))}
      </View>
      <GlassCard contentStyle={[styles.periodBar, compact && styles.periodBarCompact]}>
        <ScalePressable accessibilityLabel="Periode sebelumnya" onPress={() => movePeriod(-1)} style={[styles.arrowButton, compact && styles.arrowButtonCompact]}>
          <ChevronLeft color={palette.cocoa} size={21} />
        </ScalePressable>
        <ScalePressable accessibilityLabel={`Ubah periode, ${formatRangeLabel(value)}`} containerStyle={styles.summaryPressable} onPress={openEditor} style={[styles.summary, compact && styles.summaryCompact]}>
          {!compact ? <View style={styles.icon}><CalendarDays color={palette.cocoa} size={20} /></View> : null}
          <View style={styles.copy}>
            <Text style={styles.label}>Periode terpilih</Text>
            <Text numberOfLines={2} style={styles.value}>{formatRangeLabel(value)}</Text>
          </View>
          {!compact ? <Text style={styles.changeText}>Pilih</Text> : null}
        </ScalePressable>
        <ScalePressable accessibilityLabel="Periode berikutnya" disabled={!canMoveNext} onPress={() => movePeriod(1)} style={[styles.arrowButton, compact && styles.arrowButtonCompact]}>
          <ChevronRight color={palette.cocoa} size={21} />
        </ScalePressable>
      </GlassCard>

      <FormModal
        footer={<View style={styles.actions}><Button compact label="Batal" onPress={() => setOpen(false)} variant="secondary" /><Button compact disabled={invalidDraft} label="Terapkan filter" onPress={() => { onChange(draft); setOpen(false); }} /></View>}
        onClose={() => setOpen(false)}
        subtitle={draft.mode === 'custom' ? 'Pilih tanggal awal dan akhir.' : 'Pilih tanggal acuan untuk periode.'}
        title="Pilih periode"
        visible={open}
      >
        {draft.mode === 'custom' ? (
          <>
            <DateRow label="Tanggal awal" onPress={() => setPickerTarget('from')} value={draft.from} />
            <DateRow label="Tanggal akhir" onPress={() => setPickerTarget('to')} value={draft.to} />
          </>
        ) : (
          <DateRow label={draft.mode === 'day' ? 'Tanggal' : draft.mode === 'month' ? 'Bulan pilihan' : 'Tahun pilihan'} onPress={() => setPickerTarget('anchor')} value={draft.anchor} />
        )}
        {invalidDraft ? <Text accessibilityLiveRegion="polite" style={styles.error}>Rentang maksimal 366 hari. Perpendek tanggal awal atau akhir.</Text> : draft.mode === 'custom' ? <Text style={styles.helper}>Rentang terpilih: {draftDayCount} hari.</Text> : null}
        {pickerTarget && Platform.OS === 'web' ? (
          <WebDateInput
            label={pickerTarget === 'anchor' ? 'Tanggal acuan' : pickerTarget === 'from' ? 'Tanggal awal' : 'Tanggal akhir'}
            onChange={(selected) => updateDraftDate(pickerTarget, selected)}
            value={pickerTarget === 'anchor' ? draft.anchor : pickerTarget === 'from' ? draft.from : draft.to}
          />
        ) : pickerTarget ? (
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            mode="date"
            onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
              if (event.type === 'set' && selectedDate) updateDraftDate(pickerTarget, selectedDate);
              if (Platform.OS !== 'ios') setPickerTarget(null);
            }}
            value={pickerTarget === 'anchor' ? draft.anchor : pickerTarget === 'from' ? draft.from : draft.to}
          />
        ) : null}
      </FormModal>
    </View>
  );
}

function WebDateInput({ label, value, onChange }: { label: string; value: Date; onChange: (date: Date) => void }) {
  return (
    <View style={styles.webPickerWrap}>
      <Text style={styles.dateLabel}>{label}</Text>
      {createElement('input', {
        'aria-label': label,
        max: toDateParam(new Date()),
        onChange: (event: { currentTarget: { value: string } }) => {
          const parsed = fromDateParam(event.currentTarget.value);
          if (parsed) onChange(parsed);
        },
        style: {
          minHeight: 48,
          width: '100%',
          border: `1px solid ${palette.line}`,
          borderRadius: radius.md,
          background: 'rgba(255,255,255,0.9)',
          color: palette.ink,
          fontFamily: type.semibold,
          fontSize: 15,
          padding: '0 16px',
          boxSizing: 'border-box',
          outlineColor: palette.cocoa,
        },
        type: 'date',
        value: toDateParam(value),
      })}
    </View>
  );
}

function DateRow({ label, value, onPress }: { label: string; value: Date; onPress: () => void }) {
  const formatted = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(value);
  return (
    <ScalePressable accessibilityLabel={`${label}, ${formatted}`} onPress={onPress} style={styles.dateRow}>
      <View><Text style={styles.dateLabel}>{label}</Text><Text style={styles.dateValue}>{formatted}</Text></View>
      <CalendarDays color={palette.cocoa} size={20} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginBottom: spacing.md },
  modes: { minHeight: 48, flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, padding: 3, backgroundColor: 'rgba(255,255,255,0.58)' },
  modeCell: { flex: 1 },
  modeButton: { minHeight: 44, paddingHorizontal: spacing.xs, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  modeButtonSelected: { backgroundColor: palette.cocoaDark },
  modeText: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 12 },
  modeTextSelected: { color: palette.white },
  periodBar: { minHeight: 74, padding: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  periodBarCompact: { gap: spacing.xxs, padding: spacing.xxs },
  arrowButton: { width: 48, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,63,42,0.07)' },
  arrowButtonCompact: { width: 44 },
  summaryPressable: { flex: 1 },
  summary: { minHeight: 56, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryCompact: { paddingHorizontal: spacing.xxs, gap: spacing.xs },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  copy: { flex: 1, minWidth: 0 },
  label: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  value: { color: palette.ink, fontFamily: type.bold, fontSize: 13, marginTop: 3 },
  changeText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11 },
  dateRow: { minHeight: 68, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.72)', paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  dateValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 13, marginTop: 3 },
  webPickerWrap: { gap: spacing.xs, paddingTop: spacing.xs },
  helper: { color: palette.muted, fontFamily: type.medium, fontSize: 11, lineHeight: 17 },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
});
