import type { JwtAccessPayload } from '../auth/auth.types';
import { WalletService } from './wallet.service';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
export declare class WalletController {
    private readonly wallet;
    constructor(wallet: WalletService);
    getMyWallet(user: JwtAccessPayload): Promise<{
        wallet: {
            id: string;
            balance: number;
            totalEarned: number;
            totalWithdrawn: number;
            pendingEarnings: number;
        };
        transactions: {
            id: string;
            amount: number;
            type: string;
            status: string;
            description: string;
            orderId: string | null;
            orderType: string | null;
            couponCode: string | null;
            createdAt: Date;
        }[];
        withdrawals: {
            id: string;
            amount: number;
            payoutMethod: string;
            upiId: string | null;
            bankAccount: string | null;
            bankIfsc: string | null;
            status: string;
            adminNotes: string | null;
            processedAt: Date | null;
            createdAt: Date;
        }[];
    }>;
    requestWithdrawal(user: JwtAccessPayload, dto: RequestWithdrawalDto): Promise<{
        success: boolean;
        message: string;
        request: {
            bankAccount: string | null;
            bankIfsc: string | null;
            upiId: string | null;
            id: string;
            status: string;
            createdAt: Date;
            userId: string;
            amount: number;
            walletId: string;
            payoutMethod: string;
            processedAt: Date | null;
            accountHolderName: string | null;
            adminNotes: string | null;
        };
    }>;
}
