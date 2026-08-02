import { Module } from '@nestjs/common';
import { JobQueueService } from '../allocation/job-queue.service';
import { NotificationService } from './notification.service';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { NotificationController } from './notification.controller';
import { AdminNotificationController } from './admin-notification.controller';

@Module({
  // Reuses the JobQueueService *class* Phase 4 built (same in-process
  // setTimeout-based scheduler DeliveryModule already reused in Phase 5)
  // as its own instance here, rather than importing AllocationModule
  // directly — AllocationModule needs to call NotificationService for the
  // allocation-failed admin alert, so importing AllocationModule here
  // would create a cycle. JobQueueService has no dependencies of its own,
  // so a second instance costs nothing and keeps both modules decoupled.
  controllers: [NotificationController, AdminNotificationController],
  providers: [NotificationService, JobQueueService, FcmPushProvider, ResendEmailProvider],
  exports: [NotificationService],
})
export class NotificationModule {}
