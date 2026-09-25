import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsString, Matches, ValidateNested } from 'class-validator';
import { MEAL_SLOTS, type MealSlot } from '../meal-slots';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class MealTimingDto {
  @IsIn(MEAL_SLOTS)
  slot: MealSlot;

  @IsString()
  @Matches(TIME_RE, { message: 'start must be HH:mm' })
  start: string;

  // Earlier than `start` means the window ends after midnight.
  @IsString()
  @Matches(TIME_RE, { message: 'end must be HH:mm' })
  end: string;
}

export class UpdateMealTimingsDto {
  // Slots left out keep their default window.
  @IsArray()
  @ArrayMaxSize(MEAL_SLOTS.length)
  @ValidateNested({ each: true })
  @Type(() => MealTimingDto)
  timings: MealTimingDto[];
}
