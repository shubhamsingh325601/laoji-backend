import type { JwtAccessPayload } from '../auth/auth.types';
import { HomeTabService } from './home-tab.service';
import { UpdateHomeTabsDto } from './dto/home-tab.dto';
export declare class PublicHomeTabController {
    private readonly homeTabs;
    constructor(homeTabs: HomeTabService);
    list(): Promise<Pick<import("./home-tab.service").HomeTab, "label" | "key">[]>;
}
export declare class AdminHomeTabController {
    private readonly homeTabs;
    constructor(homeTabs: HomeTabService);
    list(): Promise<import("./home-tab.service").HomeTab[]>;
    update(dto: UpdateHomeTabsDto, admin?: JwtAccessPayload): Promise<import("./home-tab.service").HomeTab[]>;
}
