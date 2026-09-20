import type { JwtAccessPayload } from '../auth/auth.types';
import { DeliveryService } from './delivery.service';
import { AdvanceDeliveryStatusDto, ReportNotHandedOverDto, VerifyDeliveryDto } from './dto/delivery-order.dto';
export declare class DeliveryOrderController {
    private readonly delivery;
    constructor(delivery: DeliveryService);
    incoming(user: JwtAccessPayload): Promise<{
        id: string;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        deliveryPartnerId: string;
        outcome: "pending" | "rejected" | "accepted" | "timeout";
        attemptNo: number;
        slaDeadline: Date;
        createdAt: Date;
    }[]>;
    active(user: JwtAccessPayload): Promise<{
        grocery: {
            id: string;
            customerId: string;
            status: "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "failed" | "cancelled";
            subtotal: number;
            deliveryFee: number;
            platformCommission: number;
            commissionPct: number;
            total: number;
            paymentStatus: string;
            instructions: string | null;
            vendorId: string | null;
            deliveryAddressId: string;
            deliveryPartnerId: string | null;
            deliveryOtp: string | null;
            createdAt: Date;
        }[];
        food: {
            id: string;
            customerId: string;
            status: "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "failed" | "cancelled";
            subtotal: number;
            deliveryFee: number;
            platformCommission: number;
            commissionPct: number;
            total: number;
            paymentStatus: string;
            instructions: string | null;
            restaurantId: string;
            deliveryAddressId: string;
            deliveryPartnerId: string | null;
            deliveryOtp: string | null;
            createdAt: Date;
        }[];
    }>;
    detail(user: JwtAccessPayload, type: 'grocery' | 'food', id: string): Promise<{
        id: string;
        type: "grocery" | "food";
        status: string;
        orderCode: string;
        itemCount: number;
        deliveryFee: number;
        pickupName: string;
        pickupAddress: string;
        pickupPhone: string;
        pickupLat: number | null;
        pickupLng: number | null;
        dropoffCustomer: string;
        dropoffPhone: string;
        dropoffAddress: string;
        dropoffLat: number | null;
        dropoffLng: number | null;
        instructions: string;
        total: number;
        paymentStatus: string;
        isCod: boolean;
        isPaid: boolean;
        paymentMethod: "cod" | "online";
        collectCashAmount: number;
        items: {
            id?: string;
            name: string;
            qty: number;
            price: number;
        }[];
    }>;
    accept(user: JwtAccessPayload, type: 'grocery' | 'food', id: string): Promise<{
        ok: boolean;
    }>;
    reject(user: JwtAccessPayload, type: 'grocery' | 'food', id: string): Promise<{
        ok: boolean;
    }>;
    advance(user: JwtAccessPayload, type: 'grocery' | 'food', id: string, dto: AdvanceDeliveryStatusDto): Promise<{
        ok: boolean;
    }>;
    verifyDelivery(user: JwtAccessPayload, type: 'grocery' | 'food', id: string, dto: VerifyDeliveryDto): Promise<{
        ok: boolean;
    }>;
    reportNotHandedOver(user: JwtAccessPayload, type: 'grocery' | 'food', id: string, dto: ReportNotHandedOverDto): Promise<{
        success: boolean;
        message: string;
        escalation: {
            sent: boolean;
            reason: string;
            manager?: undefined;
        } | {
            sent: boolean;
            manager: {
                id: string;
                name: string;
                email: string;
                phone: string;
                pincode: string;
            };
            reason?: undefined;
        };
    }>;
}
