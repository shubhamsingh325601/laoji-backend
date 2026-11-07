import type { Db } from '../../config/database.module';
import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { type HomeTabDto, type HomeTabKey } from './dto/home-tab.dto';
export declare const HOME_TABS_SETTING = "home_tabs";
export interface HomeTab {
    key: HomeTabKey;
    label: string;
    isActive: boolean;
}
export declare class HomeTabService {
    private readonly db;
    private readonly cache?;
    constructor(db: Db, cache?: ResponseCacheService | undefined);
    listAll(): Promise<HomeTab[]>;
    listLive(): Promise<Pick<HomeTab, 'key' | 'label'>[]>;
    update(tabs: HomeTabDto[], adminId?: string): Promise<HomeTab[]>;
}
