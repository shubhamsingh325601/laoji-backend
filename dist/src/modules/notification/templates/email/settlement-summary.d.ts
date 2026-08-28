import type { EmailMessage } from '../../notification.types';
export declare function settlementSummaryEmail(periodLabel: string, gross: number, commission: number, net: number): EmailMessage;
