// Custom push sounds. A sound id names an audio file bundled in the app
// (res/raw/<id>.*) and an Android notification channel (`laoji_<id>_v2`) that the
// app creates for it; the app registers its choice with the device token and
// pushes are routed to that channel. The backend only checks the shape of the
// id, so adding a sound to the app needs no backend change.
export const NOTIFICATION_SOUND_PATTERN = /^[a-z0-9_]{1,40}$/;

export function isValidNotificationSound(value: unknown): value is string {
  return typeof value === 'string' && NOTIFICATION_SOUND_PATTERN.test(value);
}

export function soundChannelId(sound: string): string {
  return `laoji_${sound}_v2`;
}
