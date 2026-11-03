export function slugify(input: string): string {
  const s = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-') // keeps Arabic/Urdu letters
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'untitled';
}

/** Appends -2, -3... until `exists` returns false. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}
