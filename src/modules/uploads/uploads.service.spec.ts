import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadsService } from './uploads.service';
import { NotificationService } from '../notification/notification.service';
import { DRIZZLE } from '../../config/database.module';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
}));

describe('UploadsService media deletion', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CLOUDINARY_CLOUD_NAME') return 'fixzza';
              if (key === 'CLOUDINARY_API_KEY') return '579882612331142';
              if (key === 'CLOUDINARY_API_SECRET') return 'AYd18zjWOU5QproqltuRjWlr8aw';
              return undefined;
            }),
          },
        },
        {
          provide: DRIZZLE,
          useValue: {},
        },
        {
          provide: NotificationService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    jest.clearAllMocks();
  });

  it('correctly extracts publicId from Cloudinary URLs', () => {
    expect(service.extractPublicId('https://res.cloudinary.com/fixzza/image/upload/v1762534571/banners/banner-1.jpg'))
      .toBe('banners/banner-1');

    expect(service.extractPublicId('https://res.cloudinary.com/fixzza/image/upload/categories/sweets.webp'))
      .toBe('categories/sweets');

    expect(service.extractPublicId('categories/sweets'))
      .toBe('categories/sweets');

    expect(service.extractPublicId('https://images.unsplash.com/photo-1546069901-ba9599a7e63c'))
      .toBeNull();

    expect(service.extractPublicId(null as any)).toBeNull();
  });

  it('calls cloudinary.uploader.destroy when deleting media by URL', async () => {
    const destroySpy = jest.spyOn(cloudinary.uploader, 'destroy');

    const result = await service.deleteMedia('https://res.cloudinary.com/fixzza/image/upload/v1762534571/banners/banner-1.jpg');

    expect(destroySpy).toHaveBeenCalledWith('banners/banner-1', { invalidate: true });
    expect(result).toBe(true);
  });

  it('ignores external non-cloudinary URLs gracefully without throwing', async () => {
    const destroySpy = jest.spyOn(cloudinary.uploader, 'destroy');

    const result = await service.deleteMedia('https://images.unsplash.com/photo-1546069901-ba9599a7e63c');

    expect(destroySpy).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
