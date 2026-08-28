import type { Db } from '../../config/database.module';
import { AllocationService } from '../allocation/allocation.service';
import { CatalogService } from '../catalog/catalog.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { RevenueConfigService } from '../revenue/revenue-config.service';
import type { CreateGroceryOrderDto } from './dto/create-grocery-order.dto';
import type { CreateFoodOrderDto } from './dto/create-food-order.dto';
import type { AdvanceStatusDto, CorrectStatusDto } from './dto/advance-status.dto';
export declare class OrderService {
    private readonly db;
    private readonly allocation;
    private readonly catalog;
    private readonly delivery;
    private readonly payments;
    private readonly notifications;
    private readonly revenueConfig;
    constructor(db: Db, allocation: AllocationService, catalog: CatalogService, delivery: DeliveryService, payments: PaymentService, notifications: NotificationService, revenueConfig: RevenueConfigService);
    private orderCode;
    createGroceryOrder(customerId: string, dto: CreateGroceryOrderDto): Promise<{
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
    createFoodOrder(customerId: string, dto: CreateFoodOrderDto): Promise<{
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
    listMyGroceryOrders(customerId: string): Promise<{
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
    listMyFoodOrders(customerId: string): Promise<{
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
    getGroceryOrder(id: string, requester: {
        userId: string;
        role: string;
    }): Promise<{
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
    getFoodOrder(id: string, requester: {
        userId: string;
        role: string;
    }): Promise<{
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
    rateFoodOrder(customerId: string, foodOrderId: string, dto: {
        rating: number;
        comment?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        restaurantId: string;
        customerId: string;
        foodOrderId: string;
        rating: number;
        comment: string | null;
    }>;
    private withOtpVisibility;
    private enrichHistory;
    private customerSummary;
    private assertOrderAccess;
    private attachGroceryItems;
    private attachFoodItems;
    listVendorIncomingGroceryOrders(userId: string): Promise<({
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
    listVendorHistoryGroceryOrders(userId: string): Promise<({
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
    listVendorHistoryFoodOrders(userId: string): Promise<({
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
    listVendorActiveGroceryOrders(userId: string): Promise<({
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
    acceptGroceryOrder(userId: string, orderId: string): Promise<{
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
    rejectGroceryOrder(userId: string, orderId: string): Promise<{
        ok: boolean;
    }>;
    private requirePendingAttempt;
    private requirePaymentSatisfied;
    advanceGroceryOrder(userId: string, orderId: string, dto: AdvanceStatusDto): Promise<{
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
    correctGroceryOrderStatus(userId: string, orderId: string, dto: CorrectStatusDto): Promise<{
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
    private requireOwnGroceryOrder;
    listVendorIncomingFoodOrders(userId: string): Promise<({
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
    listVendorActiveFoodOrders(userId: string): Promise<({
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
    private requireOwnFoodOrder;
    acceptFoodOrder(userId: string, orderId: string): Promise<{
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
    rejectFoodOrder(userId: string, orderId: string): Promise<{
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
    advanceFoodOrder(userId: string, orderId: string, dto: AdvanceStatusDto): Promise<{
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
    correctFoodOrderStatus(userId: string, orderId: string, dto: CorrectStatusDto): Promise<{
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
    private assertForwardTransition;
    private assertCorrection;
    listAllOrdersForAdmin(): Promise<{
        grocery: {
            type: "grocery";
            customerName: string;
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
            createdAt: Date;
        }[];
        food: {
            type: "food";
            customerName: string;
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
            createdAt: Date;
        }[];
    }>;
    getOrderTimelineForAdmin(type: 'grocery' | 'food', id: string): Promise<{
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
    cancelOrder(adminUserId: string, type: 'grocery' | 'food', orderId: string): Promise<{
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
    private vendorUserIdForOrder;
}
