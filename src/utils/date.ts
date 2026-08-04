export type DateRangeMode = 'day' | 'month' | 'year' | 'custom';

export interface DateRangeSelection {
  mode: DateRangeMode;
  anchor: Date;
  from: Date;
  to: Date;
}

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const jakartaDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: JAKARTA_TIME_ZONE,
  year: 'numeric',
});

export const toJakartaDateKey = (value: Date | string = new Date()) => {
  const parsed = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = jakartaDateKeyFormatter.formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const formatJakartaBusinessDate = (value: Date = new Date()) => (
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    timeZone: JAKARTA_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
  }).format(value)
);

export const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const endOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

export const toDateParam = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fromDateParam = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

export const makeDateRange = (
  mode: DateRangeMode,
  anchor = new Date(),
  customFrom?: Date,
  customTo?: Date,
): DateRangeSelection => {
  const normalizedAnchor = startOfDay(anchor);
  if (mode === 'day') {
    return { mode, anchor: normalizedAnchor, from: normalizedAnchor, to: normalizedAnchor };
  }
  if (mode === 'month') {
    return {
      mode,
      anchor: normalizedAnchor,
      from: new Date(normalizedAnchor.getFullYear(), normalizedAnchor.getMonth(), 1),
      to: new Date(normalizedAnchor.getFullYear(), normalizedAnchor.getMonth() + 1, 0),
    };
  }
  if (mode === 'year') {
    return {
      mode,
      anchor: normalizedAnchor,
      from: new Date(normalizedAnchor.getFullYear(), 0, 1),
      to: new Date(normalizedAnchor.getFullYear(), 11, 31),
    };
  }
  const from = startOfDay(customFrom ?? normalizedAnchor);
  const to = startOfDay(customTo ?? normalizedAnchor);
  return { mode, anchor: normalizedAnchor, from: from <= to ? from : to, to: to >= from ? to : from };
};

export const formatRangeLabel = ({ mode, anchor, from, to }: DateRangeSelection) => {
  if (mode === 'day') {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(anchor);
  }
  if (mode === 'month') {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(anchor);
  }
  if (mode === 'year') return String(anchor.getFullYear());
  const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${formatter.format(from)} – ${formatter.format(to)}`;
};

export const dateRangeDayCount = ({ from, to }: Pick<DateRangeSelection, 'from' | 'to'>) => (
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1
);

export const shiftDateRange = (selection: DateRangeSelection, direction: -1 | 1): DateRangeSelection => {
  if (selection.mode === 'day') {
    const anchor = new Date(selection.anchor);
    anchor.setDate(anchor.getDate() + direction);
    return makeDateRange('day', anchor);
  }
  if (selection.mode === 'month') {
    const anchor = new Date(selection.anchor.getFullYear(), selection.anchor.getMonth() + direction, 1);
    return makeDateRange('month', anchor);
  }
  if (selection.mode === 'year') {
    const anchor = new Date(selection.anchor.getFullYear() + direction, 0, 1);
    return makeDateRange('year', anchor);
  }
  const dayCount = dateRangeDayCount(selection);
  const from = new Date(selection.from);
  const to = new Date(selection.to);
  from.setDate(from.getDate() + direction * dayCount);
  to.setDate(to.getDate() + direction * dayCount);
  return makeDateRange('custom', from, from, to);
};

export const toSalesQuery = (range: DateRangeSelection) => {
  const params = new URLSearchParams({
    from: startOfDay(range.from).toISOString(),
    to: endOfDay(range.to).toISOString(),
    limit: '1000',
  });
  return params.toString();
};
