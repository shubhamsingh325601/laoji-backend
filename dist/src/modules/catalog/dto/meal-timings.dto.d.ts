import { type MealSlot } from '../meal-slots';
export declare class MealTimingDto {
    slot: MealSlot;
    start: string;
    end: string;
}
export declare class UpdateMealTimingsDto {
    timings: MealTimingDto[];
}
