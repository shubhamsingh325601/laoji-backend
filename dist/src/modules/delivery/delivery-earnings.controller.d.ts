import type { JwtAccessPayload } from '../auth/auth.types';
import { DeliveryService } from './delivery.service';
export declare class DeliveryEarningsController {
    private readonly delivery;
    constructor(delivery: DeliveryService);
    history(user: JwtAccessPayload): Promise<({
        id: string;
        orderId: string;
        orderCode: string;
        type: "grocery";
        route: string;
        payout: number;
        status: "delivered" | "cancelled";
        completedAt: Date;
    } | {
        id: string;
        orderId: string;
        orderCode: string;
        type: "food";
        route: string;
        payout: number;
        status: "delivered" | "cancelled";
        completedAt: Date;
    })[]>;
    earnings(user: JwtAccessPayload): Promise<{
        today: {
            amount: number;
            deliveries: number;
        };
        week: {
            amount: number;
            deliveries: number;
        };
        avgPerDelivery: number;
        nextPayoutDate: string | null;
        recent: ({
            id: string;
            orderId: string;
            orderCode: string;
            type: "grocery";
            route: string;
            payout: number;
            status: "delivered" | "cancelled";
            completedAt: Date;
        } | {
            id: string;
            orderId: string;
            orderCode: string;
            type: "food";
            route: string;
            payout: number;
            status: "delivered" | "cancelled";
            completedAt: Date;
        })[];
    }>;
}
