const slugify = (text = '') =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const slugifyString = (text, fallbackPrefix = 'item') => {
  const base = slugify(text);
  if (base) {
    return base;
  }
  return `${fallbackPrefix}-${Date.now()}`;
};

export default slugify;

