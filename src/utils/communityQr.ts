const IMAGE_DATA_URL_PREFIX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i;
const IMAGE_URL_PATTERN = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^\s]*)?$/i;

export function isCommunityQrImageSource(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return IMAGE_DATA_URL_PREFIX.test(normalized) || IMAGE_URL_PATTERN.test(normalized);
}
