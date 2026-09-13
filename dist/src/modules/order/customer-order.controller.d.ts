import type { JwtAccessPayload } from '../auth/auth.types';
import { OrderService } from './order.service';
import { CreateGroceryOrderDto } from './dto/create-grocery-order.dto';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';
import { RateFoodOrderDto } from './dto/rate-food-order.dto';
export declare class CustomerOrderController {
    private readonly orders;
    constructor(orders: OrderService);
    createGrocery(user: JwtAccessPayload, dto: CreateGroceryOrderDto): Promise<{
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
    myGroceryOrders(user: JwtAccessPayload): Promise<{
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
    }[]>;
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
    createFood(user: JwtAccessPayload, dto: CreateFoodOrderDto): Promise<{
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
    myFoodOrders(user: JwtAccessPayload): Promise<{
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
    }[]>;
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
    rateFoodOrder(user: JwtAccessPayload, id: string, dto: RateFoodOrderDto): Promise<{
        id: string;
        createdAt: Date;
        customerId: string;
        restaurantId: string;
        foodOrderId: string;
        rating: number;
        comment: string | null;
    }>;
    cancelOrder(user: JwtAccessPayload, type: 'grocery' | 'food', id: string): Promise<{
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
    } | {
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
