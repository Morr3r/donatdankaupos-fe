import type { CartItem } from '../types/domain';

export function selectedVariantIds(item: CartItem): string[] {
  if (item.selectedVariantIds?.length) return item.selectedVariantIds;
  return item.selectedVariantId ? [item.selectedVariantId] : [];
}

export function selectedVariantNames(item: CartItem): string[] {
  if (item.selectedVariantNames?.length) return item.selectedVariantNames;
  return item.selectedVariantName ? [item.selectedVariantName] : [];
}

export function selectedOptionNames(item: CartItem): string[] {
  return [...selectedVariantNames(item), ...(item.selectedToppingNames ?? [])];
}

export function selectedOptionSummary(item: CartItem): string {
  return selectedOptionNames(item).join(' · ');
}
