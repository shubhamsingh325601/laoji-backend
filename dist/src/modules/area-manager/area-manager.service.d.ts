import type { Db } from '../../config/database.module';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { UpdateAreaManagerDto } from './dto/update-area-manager.dto';
import { NotificationService } from '../notification/notification.service';
import { HandoverEscalationParams } from '../notification/templates/email/handover-escalation';
export declare class AreaManagerService {
    private readonly db;
    private readonly notifications;
    private readonly logger;
    constructor(db: Db, notifications: NotificationService);
    findAll(search?: string): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        pincode: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        pincode: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateAreaManagerDto): Promise<{
        id: string;
        name: string;
        phone: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
        pincode: string;
        isActive: boolean;
    }>;
    update(id: string, dto: UpdateAreaManagerDto): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        pincode: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    findManagerForPincode(pincode?: string): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        pincode: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    dispatchHandoverEscalation(params: HandoverEscalationParams): Promise<{
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
    }>;
}
