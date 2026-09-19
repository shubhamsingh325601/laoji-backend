import { DeliveryService } from './delivery.service';
import { CreateAdminDeliveryPartnerDto, UpdateAdminDeliveryPartnerDto } from './dto/admin-delivery.dto';
export declare class AdminDeliveryController {
    private readonly delivery;
    constructor(delivery: DeliveryService);
    list(): Promise<{
        id: string;
        userId: string;
        name: string;
        phone: string;
        email: string;
        vehicleType: string;
        kycStatus: "pending" | "verified" | "rejected";
        online: boolean;
        activity: string;
        zone: string;
        todayEarnings: number;
        totalDeliveries: number;
        createdAt: Date;
    }[]>;
    getOne(id: string): Promise<{
        id: string;
        userId: string;
        name: string;
        phone: string;
        email: string;
        vehicleType: string;
        kycStatus: "pending" | "verified" | "rejected";
        online: boolean;
        activity: string;
        zone: string;
        kycDocuments: {
            id: string;
            userId: string;
            role: "customer" | "vendor" | "delivery_partner" | "admin";
            docType: string;
            secureUrl: string;
            publicId: string;
            status: "pending" | "verified" | "rejected";
            rejectionReason: string | null;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            uploadedAt: Date;
        }[];
        todayEarnings: number;
        totalDeliveries: number;
        createdAt: Date;
    }>;
    create(dto: CreateAdminDeliveryPartnerDto): Promise<{
        name: string;
        phone: string;
        email: string | null;
        id: string;
        createdAt: Date;
        userId: string;
        aadhaarNumber: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        upiId: string | null;
        kycStatus: "pending" | "verified" | "rejected";
        vehicleType: string;
        drivingLicense: string | null;
        isOnline: boolean;
        currentLat: number | null;
        currentLng: number | null;
        updatedAt: Date;
    }>;
    update(id: string, dto: UpdateAdminDeliveryPartnerDto): Promise<{
        id: string;
        userId: string;
        kycStatus: "pending" | "verified" | "rejected";
        vehicleType: string;
        aadhaarNumber: string | null;
        drivingLicense: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        upiId: string | null;
        isOnline: boolean;
        currentLat: number | null;
        currentLng: number | null;
        updatedAt: Date;
        createdAt: Date;
    }>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
