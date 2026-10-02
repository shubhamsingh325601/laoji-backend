import { WalletService } from './wallet.service';
import { ProcessWithdrawalDto } from './dto/request-withdrawal.dto';
export declare class AdminWalletController {
    private readonly wallet;
    constructor(wallet: WalletService);
    listRequests(status?: string): Promise<{
        id: string;
        userId: string;
        walletId: string;
        amount: number;
        payoutMethod: string;
        upiId: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        accountHolderName: string | null;
        status: string;
        adminNotes: string | null;
        processedAt: Date | null;
        createdAt: Date;
        userName: string | null;
        userPhone: string | null;
        userEmail: string | null;
        userRole: "customer" | "vendor" | "delivery_partner" | "admin" | null;
    }[]>;
    approveRequest(id: string, dto: ProcessWithdrawalDto): Promise<{
        id: string;
        userId: string;
        walletId: string;
        amount: number;
        payoutMethod: string;
        upiId: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        accountHolderName: string | null;
        status: string;
        adminNotes: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
    rejectRequest(id: string, dto: ProcessWithdrawalDto): Promise<{
        id: string;
        userId: string;
        walletId: string;
        amount: number;
        payoutMethod: string;
        upiId: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        accountHolderName: string | null;
        status: string;
        adminNotes: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
}
