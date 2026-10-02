import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { VendorDiscountsService } from './vendor-discounts.service';
export declare class PublicVendorDiscountsController {
    private readonly discountsService;
    private readonly jwtService;
    private readonly config;
    constructor(discountsService: VendorDiscountsService, jwtService: JwtService, config: ConfigService);
    listActive(vendorId: string, req: Request): Promise<{
        id: string;
        vendorId: string;
        title: string;
        scope: string;
        productId: string | null;
        menuItemId: string | null;
        discountType: string;
        discountValue: number;
        maxDiscount: number | null;
        minOrderValue: number;
        startTime: string | null;
        endTime: string | null;
        startDate: string | null;
        endDate: string | null;
    }[]>;
    private userIdFrom;
}
