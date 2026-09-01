import type { JwtAccessPayload } from '../auth/auth.types';
import { OrderService } from './order.service';
import { AdvanceStatusDto, CorrectStatusDto } from './dto/advance-status.dto';
export declare class VendorOrderController {
    private readonly orders;
    constructor(orders: OrderService);
    groceryIncoming(user: JwtAccessPayload): Promise<({
        slaDeadline: Date;
        attemptId: string;
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    } & {
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
    })[]>;
    groceryActive(user: JwtAccessPayload): Promise<({
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    } & {
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
    })[]>;
    groceryHistory(user: JwtAccessPayload): Promise<({
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    } & {
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
    })[]>;
    groceryOrder(user: JwtAccessPayload, id: string): Promise<{
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    acceptGrocery(user: JwtAccessPayload, id: string): Promise<{
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    rejectGrocery(user: JwtAccessPayload, id: string): Promise<{
        ok: boolean;
    }>;
    advanceGrocery(user: JwtAccessPayload, id: string, dto: AdvanceStatusDto): Promise<{
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    correctGrocery(user: JwtAccessPayload, id: string, dto: CorrectStatusDto): Promise<{
        items: {
            id: string;
            groceryOrderId: string;
            productId: string;
            qty: number;
            unitPrice: number;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    foodIncoming(user: JwtAccessPayload): Promise<({
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    } & {
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
    })[]>;
    foodActive(user: JwtAccessPayload): Promise<({
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    } & {
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
    })[]>;
    foodHistory(user: JwtAccessPayload): Promise<({
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    } & {
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
    })[]>;
    foodOrder(user: JwtAccessPayload, id: string): Promise<{
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        myRating: {
            id: string;
            foodOrderId: string;
            customerId: string;
            restaurantId: string;
            rating: number;
            comment: string | null;
            createdAt: Date;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    acceptFood(user: JwtAccessPayload, id: string): Promise<{
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        myRating: {
            id: string;
            foodOrderId: string;
            customerId: string;
            restaurantId: string;
            rating: number;
            comment: string | null;
            createdAt: Date;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    rejectFood(user: JwtAccessPayload, id: string): Promise<{
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        myRating: {
            id: string;
            foodOrderId: string;
            customerId: string;
            restaurantId: string;
            rating: number;
            comment: string | null;
            createdAt: Date;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    advanceFood(user: JwtAccessPayload, id: string, dto: AdvanceStatusDto): Promise<{
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        myRating: {
            id: string;
            foodOrderId: string;
            customerId: string;
            restaurantId: string;
            rating: number;
            comment: string | null;
            createdAt: Date;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
    correctFood(user: JwtAccessPayload, id: string, dto: CorrectStatusDto): Promise<{
        items: {
            id: string;
            foodOrderId: string;
            menuItemId: string;
            qty: number;
            unitPrice: number;
            addonsJson: unknown;
        }[];
        history: {
            actorName: string;
            id: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            groceryOrderId: string | null;
            foodOrderId: string | null;
            actorRole: "customer" | "vendor" | "delivery_partner" | "admin" | "system";
            changedBy: string | null;
            changedAt: Date;
        }[];
        customer: {
            name: string;
            phone: string;
            line1: string;
            area: string;
            city: string;
        };
        myRating: {
            id: string;
            foodOrderId: string;
            customerId: string;
            restaurantId: string;
            rating: number;
            comment: string | null;
            createdAt: Date;
        };
        id: string;
        customerId: string;
        status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
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
    }>;
}
