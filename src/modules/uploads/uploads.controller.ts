import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { UploadsService } from './uploads.service';
import { SignatureRequestDto } from './dto/signature-request.dto';
import { SaveKycDocumentDto } from './dto/save-kyc-document.dto';
import { ReviewKycDocumentDto } from './dto/review-kyc-document.dto';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('signature')
  getSignature(@CurrentUser() user: JwtAccessPayload, @Body() dto: SignatureRequestDto) {
    return this.uploads.signUpload(user.sub, dto.type);
  }

  @Post('kyc-documents')
  saveKycDocument(@CurrentUser() user: JwtAccessPayload, @Body() dto: SaveKycDocumentDto) {
    return this.uploads.saveKycDocument(user.sub, user.role, dto);
  }

  @Get('kyc-documents/me')
  myKycDocuments(@CurrentUser() user: JwtAccessPayload) {
    return this.uploads.listMyKycDocuments(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('kyc-documents')
  allKycDocuments(@Query('status') status?: 'pending' | 'verified' | 'rejected') {
    return this.uploads.listAllKycDocuments(status);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch('kyc-documents/:id/review')
  reviewKycDocument(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: ReviewKycDocumentDto) {
    return this.uploads.reviewKycDocument(user.sub, id, dto.status, dto.rejectionReason);
  }
}
