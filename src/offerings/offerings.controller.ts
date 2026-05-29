import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OfferingsService } from './offerings.service';
import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateOfferingDto } from './dto/create-offering.dto';
import {
  OfferingResponseDto,
  OfferingWithSessionsResponseDto,
} from './dto/offering-response.dto';

@ApiTags('Offerings')
@ApiHeader({ name: 'x-user-id', required: true, description: 'UUID of the authenticated user' })
@ApiHeader({ name: 'x-user-role', required: true, description: '"teacher" or "parent"' })
@ApiHeader({ name: 'x-user-timezone', required: true, description: 'IANA timezone string, e.g. Asia/Kolkata' })
@Controller('offerings')
@UseGuards(MockAuthGuard)
export class OfferingsController {
  constructor(private readonly offeringsService: OfferingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an offering under one of the teacher\'s courses' })
  @ApiResponse({ status: 201, description: 'Offering created', type: OfferingResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  @ApiResponse({ status: 403, description: 'Caller is not a teacher or does not own the course' })
  @ApiResponse({ status: 404, description: 'Course not found' })
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

  @Get()
  @ApiOperation({
    summary: 'List all published offerings with sessions in the caller\'s timezone',
  })
  @ApiResponse({
    status: 200,
    description: 'Published offerings with localised session times',
    type: [OfferingWithSessionsResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
  async findAllPublished(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OfferingWithSessionsResponseDto[]> {
    const offerings = await this.offeringsService.findAllPublished(currentUser.timezone);
    return offerings.map(OfferingWithSessionsResponseDto.fromLocalised);
  }

  @Get('mine')
  @ApiOperation({
    summary: "List the teacher's own offerings with sessions in the teacher's timezone",
  })
  @ApiResponse({
    status: 200,
    description: "Teacher's offerings with localised session times",
    type: [OfferingWithSessionsResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Missing auth headers' })
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
