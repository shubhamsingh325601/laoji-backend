import type { EmailMessage } from '../../notification.types';

export function orderReceiptEmail(orderCode: string, total: number, items: { name: string; qty: number; price: number }[]): EmailMessage {
  const rows = items.map((i) => `<tr><td>${i.qty}× ${i.name}</td><td>₹${i.price * i.qty}</td></tr>`).join('');
  return {
    subject: `Your Laoji receipt — order ${orderCode}`,
    html: `<p>Thanks for your order!</p><table>${rows}</table><p><strong>Total: ₹${total}</strong></p>`,
  };
}
