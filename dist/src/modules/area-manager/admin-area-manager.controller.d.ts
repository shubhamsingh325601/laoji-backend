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
}
