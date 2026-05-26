import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Regimen } from '../entities/regimen.entity';

@Injectable()
export class RegimenService {
  constructor(
    @InjectRepository(Regimen)
    private regimenRepo: Repository<Regimen>,
  ) {}

  /**
   * Parse regimen string (e.g., "1j=TDF-3TC-DTG")
   */
  parseRegimenString(
    regimenStr: string,
  ): { alias: string; fullName: string } | null {
    if (!regimenStr) return null;

    const parts = regimenStr.split('=');
    if (parts.length === 2) {
      return {
        alias: parts[0].trim(),
        fullName: parts[1].trim(),
      };
    }

    // If no alias separator, treat the whole string as both alias and fullName
    return {
      alias: regimenStr.trim(),
      fullName: regimenStr.trim(),
    };
  }

  /**
   * Find or create regimen from imported data
   */
  async findOrCreate(regimenStr: string): Promise<Regimen | null> {
    if (!regimenStr || regimenStr.trim() === '') return null;

    const parsed = this.parseRegimenString(regimenStr);
    if (!parsed) return null;

    // Try to find by alias first
    let regimen = await this.regimenRepo.findOne({
      where: { alias: parsed.alias },
    });

    if (!regimen) {
      // Try by full name
      regimen = await this.regimenRepo.findOne({
        where: { fullName: parsed.fullName },
      });
    }

    if (!regimen) {
      regimen = this.regimenRepo.create(parsed);
      await this.regimenRepo.save(regimen);
    }

    return regimen;
  }

  async findAll(): Promise<Regimen[]> {
    return await this.regimenRepo.find({ order: { alias: 'ASC' } });
  }

  async create(data: Partial<Regimen>): Promise<Regimen> {
    const regimen = this.regimenRepo.create(data);
    return await this.regimenRepo.save(regimen);
  }

  async update(id: string, data: Partial<Regimen>): Promise<Regimen> {
    await this.regimenRepo.update(id, data);
    return await this.regimenRepo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.regimenRepo.delete(id);
  }
}
