const APP_BLOB_PROXY_PREFIX = '/api/blob?key=';
const LOCAL_STORAGE_PREFIX = '/local-paper-assets/';

export function isAppStorageUrl(value: string) {
  return value.startsWith(APP_BLOB_PROXY_PREFIX) || value.startsWith(LOCAL_STORAGE_PREFIX);
}

export function isPersistedAudioUrl(value: string) {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:audio/') ||
    isAppStorageUrl(value)
  );
}

export function isAudioAnswerValue(value: string) {
  return value.startsWith('blob:') || isPersistedAudioUrl(value);
}

export function isLikelyAudioUrl(value: string) {
  return (
    value.startsWith('data:audio/') ||
    /(?:^|\/)(speaking|audio)[-_./]/i.test(value) ||
    /\.(mp3|wav|m4a|ogg|webm|aac)(?:$|[?#])/i.test(value) ||
    isAppStorageUrl(value)
  );
}

export function getAudioSourceType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('data:audio/')) {
    const match = normalized.match(/^data:(audio\/[^;,]+)/);
    return match?.[1] ?? 'audio/*';
  }
  if (/\.m4a(?:$|[?#])/i.test(value)) return 'audio/mp4';
  if (/\.mp3(?:$|[?#])/i.test(value)) return 'audio/mpeg';
  if (/\.wav(?:$|[?#])/i.test(value)) return 'audio/wav';
  if (/\.ogg(?:$|[?#])/i.test(value)) return 'audio/ogg';
  if (/\.aac(?:$|[?#])/i.test(value)) return 'audio/aac';
  return 'audio/webm';
}
