import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';
import { AllocationService } from './allocation.service';
import { JobQueueService } from './job-queue.service';

@Module({
  imports: [PaymentModule, NotificationModule],
  providers: [AllocationService, JobQueueService],
  // JobQueueService is exported too — Delivery module (Phase 5) reuses the
  // exact same in-process timeout scheduler for assignment SLAs, per the
  // "reuse the pattern, don't reinvent it" instruction.
  exports: [AllocationService, JobQueueService],
})
export class AllocationModule {}
