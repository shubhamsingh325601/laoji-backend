import { IsIn } from 'class-validator';

export const FORWARD_STATUSES = ['preparing', 'ready', 'handed_over'] as const;

export class AdvanceStatusDto {
  @IsIn(FORWARD_STATUSES)
  status: (typeof FORWARD_STATUSES)[number];
}

// "Correct last status" (TRD Section 9.2) — steps back exactly one stage,
// not free-form backward navigation.
export const CORRECTABLE_STATUSES = ['vendor_accepted', 'preparing', 'ready', 'handed_over'] as const;

export class CorrectStatusDto {
  @IsIn(CORRECTABLE_STATUSES)
  status: (typeof CORRECTABLE_STATUSES)[number];
}
