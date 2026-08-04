const legacyBrandPattern = /\bDonat\s*(?:&|dan)\s*Kau\b/gi;

export const normalizeBrandText = (value: string) => value.replace(legacyBrandPattern, 'Donat Dankau');

export const normalizeBrandCopy = <T>(value: T): T => {
  if (typeof value === 'string') return normalizeBrandText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeBrandCopy(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeBrandCopy(item)]),
    ) as T;
  }
  return value;
};
