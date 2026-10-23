import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditListQueryDto } from './dto/audit-list.dto';

// Read-only on purpose: nothing here (or anywhere) edits or removes entries.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: AuditListQueryDto) {
    return this.audit.list(query);
  }

  @Get('filters')
  filters() {
    return this.audit.filters();
  }
}
