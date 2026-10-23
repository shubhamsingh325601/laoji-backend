import type { ConfigService } from '@nestjs/config';
import { UpiDeepLinkProvider } from './upi-deeplink.provider';

describe('UpiDeepLinkProvider', () => {
  const env: Record<string, string> = { UPI_VPA: '8005949152-3@ybl', UPI_PAYEE_NAME: 'Laoji Foods' };
  const provider = new UpiDeepLinkProvider({ get: (key: string) => env[key] } as unknown as ConfigService);
  const orderId = 'abcd1234-0000-4000-8000-000000000000';

  it('builds a upi://pay link with %20 for spaces, not "+"', async () => {
    const result = await provider.initiate({ orderId, amount: 249.5 });

    expect(result.status).toBe('pending');
    expect(result.upiDeepLink).toBe(
      `upi://pay?pa=8005949152-3@ybl&pn=Laoji%20Foods&am=249.50&tr=${orderId}&tn=Laoji%20Order%20ABCD1234&cu=INR`,
    );
    expect(result.upiDeepLink).not.toContain('+');
  });

  it('has no custom-scheme return url, which UPI apps reject or ignore', async () => {
    const result = await provider.initiate({ orderId, amount: 10 });

    expect(result.upiDeepLink).not.toContain('url=');
    expect(result.upiDeepLink).not.toContain('laojiuser');
  });
});
