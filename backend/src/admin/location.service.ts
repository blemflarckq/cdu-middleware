import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../entities/location.entity';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
  ) {}

  /**
   * Find or create location from imported data
   */
  async findOrCreate(name: string): Promise<Location | null> {
    if (!name || name.trim() === '') return null;

    const normalizedName = name.trim();

    let location = await this.locationRepo.findOne({
      where: { name: normalizedName },
    });

    if (!location) {
      location = this.locationRepo.create({ name: normalizedName });
      await this.locationRepo.save(location);
    }

    return location;
  }

  async findAll(): Promise<Location[]> {
    return await this.locationRepo.find({ order: { name: 'ASC' } });
  }

  async create(data: Partial<Location>): Promise<Location> {
    const location = this.locationRepo.create(data);
    return await this.locationRepo.save(location);
  }

  async update(id: string, data: Partial<Location>): Promise<Location> {
    await this.locationRepo.update(id, data);
    return await this.locationRepo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.locationRepo.delete(id);
  }
}
