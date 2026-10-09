import { AreaManagerService } from './area-manager.service';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { UpdateAreaManagerDto } from './dto/update-area-manager.dto';
export declare class AdminAreaManagerController {
    private readonly areaManagerService;
    constructor(areaManagerService: AreaManagerService);
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
        phone: string;
        email: string;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        pincode: string;
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
}
