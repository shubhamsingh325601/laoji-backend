export declare const MEAL_SLOTS: readonly ["breakfast", "lunch", "dinner"];
export type MealSlot = (typeof MEAL_SLOTS)[number];
export interface MealTiming {
    slot: MealSlot;
    start: string;
    end: string;
}
export declare const DEFAULT_MEAL_TIMINGS: MealTiming[];
type StoredTimings = {
    slot: string;
    start: string;
    end: string;
}[] | null | undefined;
export declare function effectiveMealTimings(stored: StoredTimings): MealTiming[];
export declare function mealTimingsView(stored: StoredTimings): {
    label: string;
    slot: MealSlot;
    start: string;
    end: string;
}[];
export declare function normalizeMealSlots(slots: string[] | null | undefined): MealSlot[] | null;
export declare function validateMealTimings(timings: MealTiming[]): void;
export declare function mealSlotsNow(timings: MealTiming[], now?: Date): MealSlot[];
export declare function isServedNow(mealSlots: string[] | null | undefined, timings: MealTiming[], now?: Date): boolean;
export declare function describeMealSlots(mealSlots: string[], timings: MealTiming[]): string;
export {};
