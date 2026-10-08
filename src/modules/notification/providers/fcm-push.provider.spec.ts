import { ConfigService } from '@nestjs/config';
import { FcmPushProvider } from './fcm-push.provider';

const sendMock = jest.fn().mockResolvedValue('msg-id');

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn((c) => c),
  initializeApp: jest.fn(() => ({})),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ send: (...args: unknown[]) => sendMock(...args) })),
}));

function makeProvider() {
  const config = {
    get: (key: string) =>
      ({ FIREBASE_PROJECT_ID: 'p', FIREBASE_CLIENT_EMAIL: 'e@p.iam', FIREBASE_PRIVATE_KEY: 'k' })[key],
  } as unknown as ConfigService;
  return new FcmPushProvider(config);
}

const message = { title: 'New order', body: 'Order #12' };

describe('FcmPushProvider custom sound', () => {
  beforeEach(() => sendMock.mockClear());

  it('routes to the sound channel the vendor picked', async () => {
    await makeProvider().send('t'.repeat(20), message, { androidSound: 'mandir_ghanti' });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.android.notification.channelId).toBe('laoji_mandir_ghanti');
    expect(payload.android.notification.sound).toBe('mandir_ghanti');
    expect(payload.android.priority).toBe('high');
  });

  it('keeps the default channel when no sound was chosen', async () => {
    await makeProvider().send('t'.repeat(20), message);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.android.notification.channelId).toBe('default');
    expect(payload.android.notification.sound).toBe('default');
  });

  it.each(['', 'Bad Sound', '../etc', 'x'.repeat(41)])('ignores a malformed sound id %j', async (bad) => {
    await makeProvider().send('t'.repeat(20), message, { androidSound: bad });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.android.notification.channelId).toBe('default');
  });
});
