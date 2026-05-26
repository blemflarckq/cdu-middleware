import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { DrugPickupPointService } from './drug-pickup-point.service';
import { LocationService } from './location.service';
import { RegimenService } from './regimen.service';

@Controller('admin')
export class AdminController {
  constructor(
    private pickupPointService: DrugPickupPointService,
    private locationService: LocationService,
    private regimenService: RegimenService,
  ) {}

  // ============ Drug Pickup Points ============
  @Get('pickup-points')
  async getPickupPoints() {
    return await this.pickupPointService.findAll();
  }

  @Post('pickup-points/sync')
  async syncPickupPoints() {
    return await this.pickupPointService.fetchFromExternalAPI();
  }

  @Post('pickup-points')
  async createPickupPoint(@Body() data: any) {
    return await this.pickupPointService.create(data);
  }

  @Put('pickup-points/:id')
  async updatePickupPoint(@Param('id') id: string, @Body() data: any) {
    return await this.pickupPointService.update(id, data);
  }

  @Delete('pickup-points/:id')
  async deletePickupPoint(@Param('id') id: string) {
    return await this.pickupPointService.delete(id);
  }

  // ============ Locations ============
  @Get('locations')
  async getLocations() {
    return await this.locationService.findAll();
  }

  @Post('locations')
  async createLocation(@Body() data: any) {
    return await this.locationService.create(data);
  }

  @Put('locations/:id')
  async updateLocation(@Param('id') id: string, @Body() data: any) {
    return await this.locationService.update(id, data);
  }

  @Delete('locations/:id')
  async deleteLocation(@Param('id') id: string) {
    return await this.locationService.delete(id);
  }

  // ============ Regimens ============
  @Get('regimens')
  async getRegimens() {
    return await this.regimenService.findAll();
  }

  @Post('regimens')
  async createRegimen(@Body() data: any) {
    return await this.regimenService.create(data);
  }

  @Put('regimens/:id')
  async updateRegimen(@Param('id') id: string, @Body() data: any) {
    return await this.regimenService.update(id, data);
  }

  @Delete('regimens/:id')
  async deleteRegimen(@Param('id') id: string) {
    return await this.regimenService.delete(id);
  }
}
