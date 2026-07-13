import {
  Controller,
  Post,
  Param,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Box } from '../entities/box.entity';

@Controller('logistics')
export class LogisticsController {
  constructor(
    private readonly logisticsService: LogisticsService,
    @InjectRepository(Box)
    private boxRepo: Repository<Box>,
  ) {}

  /**
   * Send a closed box to logistics system
   */
  @Post('send-box/:boxId')
  @HttpCode(HttpStatus.OK)
  async sendBoxToLogistics(@Param('boxId') boxId: string) {
    return await this.logisticsService.sendBoxToLogistics(boxId);
  }

  /**
   * Check status of a logistics request
   */
  @Get('status/:reference')
  async getLogisticsStatus(
    @Param('reference') reference: string,
  ): Promise<unknown> {
    return await this.logisticsService.getLogisticsStatus(reference);
  }

  /**
   * Retry a failed box
   */
  @Post('retry-box/:boxId')
  @HttpCode(HttpStatus.OK)
  async retryFailedBox(@Param('boxId') boxId: string) {
    return await this.logisticsService.retryFailedBox(boxId);
  }

  /**
   * Get all boxes with their logistics status
   */
  @Get('boxes/status')
  async getAllBoxesWithLogisticsStatus() {
    return await this.boxRepo.find({
      select: [
        'id',
        'boxNumber',
        'status',
        'logisticsStatus',
        'logisticsReference',
        'logisticsSentAt',
        'logisticsLastError',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific box's logistics status
   */
  @Get('box/:boxId/status')
  async getBoxLogisticsStatus(@Param('boxId') boxId: string) {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
      select: [
        'id',
        'boxNumber',
        'status',
        'logisticsStatus',
        'logisticsReference',
        'logisticsSentAt',
        'logisticsLastError',
        'logisticsResponse',
      ],
    });

    if (!box) {
      throw new Error('Box not found');
    }

    return box;
  }
}
