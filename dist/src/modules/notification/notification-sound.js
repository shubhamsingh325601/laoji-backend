"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_SOUND_PATTERN = void 0;
exports.isValidNotificationSound = isValidNotificationSound;
exports.soundChannelId = soundChannelId;
exports.NOTIFICATION_SOUND_PATTERN = /^[a-z0-9_]{1,40}$/;
function isValidNotificationSound(value) {
    return typeof value === 'string' && exports.NOTIFICATION_SOUND_PATTERN.test(value);
}
function soundChannelId(sound) {
    return `laoji_${sound}`;
}
//# sourceMappingURL=notification-sound.js.map