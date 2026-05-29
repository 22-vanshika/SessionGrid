import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OfferingsService } from './offerings.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateOfferingDto } from './dto/create-offering.dto';
import {
  OfferingResponseDto,
  OfferingWithSessionsResponseDto,
} from './dto/offering-response.dto';

@Controller('offerings')
@UseGuards(MockAuthGuard)
export class OfferingsController {
  constructor(private readonly offeringsService: OfferingsService) {}

  @Post()
  async create(
    @Body() dto: CreateOfferingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OfferingResponseDto> {
    const offering = await this.offeringsService.create(currentUser.id, {
      courseId: dto.courseId,
      capacity: dto.capacity,
      status: dto.status,
    });
    return OfferingResponseDto.fromEntity(offering);
  }

  // GET /offerings — all published offerings with sessions in the caller's timezone.
  @Get()
  async findAllPublished(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OfferingWithSessionsResponseDto[]> {
    const offerings = await this.offeringsService.findAllPublished(currentUser.timezone);
    return offerings.map(OfferingWithSessionsResponseDto.fromLocalised);
  }

  // GET /offerings/mine — teacher's own offerings with sessions in the teacher's timezone.
  @Get('mine')
  async findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OfferingWithSessionsResponseDto[]> {
    const offerings = await this.offeringsService.findAllByTeacherId(
      currentUser.id,
      currentUser.timezone,
    );
    return offerings.map(OfferingWithSessionsResponseDto.fromLocalised);
  }
}
