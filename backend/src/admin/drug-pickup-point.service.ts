/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DrugPickupPoint } from '../entities/drug-pickup-point.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * 🔥 HARDCODED PICKUP POINT TRANSLATIONS
 * These are exact (normalized) matches that take priority over fuzzy matching.
 * Key = normalized alias from the file
 * Value = normalized DB name to look up
 *
 * If you need to add more, just add them to this map.
 */
const PUP_ALIASES: Record<string, string> = {
  // ============ EXACT TRANSLATIONS FROM YOUR LIST ============
  'kayalethu pharmacy (tsolo)': 'kayalethu pharmacy (tsolo) pup',
  'qoaling elocker': 'qoaling filter clinic collect&go',
  'dial for life pharmacy (lithoteng)':
    'dial for life pharmacy (lithoteng) pup',
  'pholohong pharmacy (ha abia)': 'pholohong pharmacy pup',
  'wamma pharmacy (matala)': 'wamma pharmacy matala pup',
  'e-locker ntshekhe hospital': 'ntsekhe elocker',
  'ether pharmacy (kingsway)': 'ether pharmacy (kingsway)',
  'likotsi filter clinic, maseru': 'likotsi filter clinic collect&go',
  'husteds (kingsway)': 'husteds pharmacy kingsway pup',
  'family health pharmacy (thetsane)': 'family health pharmacy pup',
  'medicos pharmacy (ha tsolo)': 'medicos pharmacy pup',
  'wamma  pharmacy (pitso ground)': 'wamma pharmacy pitso ground pup',
  'maletsunyane pharmacy (qoaling)': 'maletsunyane pharmacy (qoaling) pup',
  's&t pharmacy (sefika)': 's&t pharmacy pup',
  'mago enterprise (khubetsoana)': 'mago enterprise (khubetsoana) pharmacy pup',
  'elocker mafeteng hospital': 'mafeteng hospital collect&go',
  'elocker ntsekhe hospital': 'ntsekhe elocker',
  'qualipro (lekhaloaneng)': 'quali pro pharmacy lekhalaneng pup',
  'maseru baylor clinic': 'baylor paediatric collect&go',
  'bakoena pharmacy (town)': 'bakoena pharmacy pup',
  'pharma best pharmacy (town)': 'pharm best pharmacy pup',
  'medical healthcare (town)': 'naleli medic health care pharmacy pup',
  'qualipro (nelese)': 'quali pro pharmacy nelese pup',
  'best care pharmacy ( leqele)': 'best care pharmacy (leqele) pup',
  'maseru mall': 'maseru mall collect&go',
  'nazareth hc elocker': 'nazareth health centre collect&go',
  'exceed pharmacy (roma)': 'exceed pharmacy (roma) pup',
  'machache (naleli)': 'machache naleli pharmacy pup',
  'holy cross hc e-locker': 'holy cross elocker',
  'medic discount pharmacy (roma)': 'medic discount pharmacy (roma) pup',
  'bophelong medicare pharmacy (town)': 'bophelong pharmacy pup',
  'domiciliary hc': 'domiciliary health clinic collect&go',
  'animan pharmacy (khubetsoana)': 'animan pharmacy pup',
  'medic health care (naleli)': 'naleli medic health care pharmacy pup',
  'husteds (lndc)': 'husteds lndc pharmacy pup',
  'matsieng hc, maseru': 'matsieng clinic collect&go',
  'pioneer mall': 'pioneer mall collect&go',
  'capricon pharmacy (town)': 'capricorn pharmacy pup',
  'theo pharmaceuticals': 'theo pharmaceuticals pup',
  'medicos pharmacy': 'medicos pharmacy pup',
  'pholohong pharmacy': 'pholohong pharmacy pup',
  'khayalethu pharmacy': 'kayalethu pharmacy (tsolo) pup',
  'dial for life pharmacy': 'dial for life pharmacy (lithoteng) pup',
  'maletsunyane qoaling': 'maletsunyane pharmacy (qoaling) pup',
  'qoali pro lekhalaneng': 'quali pro pharmacy lekhalaneng pup',
  's$t pharmacy': 's&t pharmacy pup',
  'dial for life pharmacy ': 'dial for life pharmacy (lithoteng) pup',
  'wamma pharmacy pitso ground': 'wamma pharmacy pitso ground pup',
  'rite care pharmacy( motsekuoa)': 'rite care pharmacy pup',
  'quali-pro  lekhalaneng': 'quali pro pharmacy lekhalaneng pup',
  'husteds pharmacy': 'husteds pharmacy kingsway pup',
  'quali pro pharmacy ha nnelese': 'quali pro pharmacy nelese pup',
  'maletsunyane (qoaling)': 'maletsunyane pharmacy (qoaling) pup',
  'qualipro (lekhalaneng)': 'quali pro pharmacy lekhalaneng pup',
  'dial for life (lithoteng)': 'dial for life pharmacy (lithoteng) pup',
  'medicos pharmacy ': 'medicos pharmacy pup',
  's&t pharmacy': 's&t pharmacy pup',
  medicos: 'medicos pharmacy pup',
  'snt pharmacy': 's&t pharmacy pup',
  'family health': 'family health pharmacy pup',
  'ntsekhe hos': 'ntsekhe elocker',
  'ntsekhe e-locker ': 'ntsekhe elocker',
  'medical healthcare': 'naleli medic health care pharmacy pup',
  'bophelong medicare pharmacy': 'bophelong pharmacy pup',
  'nazareth hc e locker': 'nazareth health centre collect&go',
  'medical healthcare pharmacy': 'naleli medic health care pharmacy pup',
  'domiciliary e locker': 'domiciliary health clinic collect&go',
  'elocker thabana morena': 'thabana morena collect&go',
};

@Injectable()
export class DrugPickupPointService {
  private readonly logger = new Logger(DrugPickupPointService.name);
  private readonly API_BASE_URL =
    'http://api.bonolohealth.gov.ls/api/Ministry%20of%20Health';

  constructor(
    @InjectRepository(DrugPickupPoint)
    private pickupPointRepo: Repository<DrugPickupPoint>,
    private httpService: HttpService,
  ) {}

  /**
   * Fetch drug pickup points from third-party API (request-response pattern)
   */
  async fetchFromExternalAPI(): Promise<DrugPickupPoint[]> {
    const guid = uuidv4();
    this.logger.log(`Starting API fetch with GUID: ${guid}`);

    try {
      await this.sendPostRequest(guid);
      const responseData = await this.pollForResponse(guid);
      const pickupPoints = this.parseApiResponse(responseData);
      this.logger.log(`Received ${pickupPoints.length} pickup points from API`);

      return await this.syncPickupPoints(pickupPoints);
    } catch (error) {
      this.logger.error(
        `Failed to fetch from external API: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Failed to sync pickup points from external API',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async sendPostRequest(guid: string): Promise<void> {
    const requestBody = {
      Reference: guid,
      Type: 0,
      Method: 'GetLocation',
      Body: '{}',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.API_BASE_URL, requestBody, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      if (response.status !== 200) {
        throw new Error(`POST request failed with status: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`POST request failed: ${(error as Error).message}`);
      throw new Error(
        `Failed to initiate API request: ${(error as Error).message}`,
      );
    }
  }

  private async pollForResponse(
    guid: string,
    maxAttempts: number = 12,
    initialDelay: number = 3000,
  ): Promise<any> {
    await this.delay(initialDelay);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.API_BASE_URL}/getMessage/${guid}`),
        );

        if (
          response.data &&
          response.data.body &&
          response.data.body !== '{}' &&
          response.data.body !== 'null'
        ) {
          return response.data;
        }

        await this.delay(initialDelay * attempt);
      } catch (error) {
        this.logger.debug(
          `Attempt ${attempt} failed: ${(error as Error).message}`,
        );
        await this.delay(initialDelay);
      }
    }

    throw new Error(
      `No response received after ${maxAttempts} attempts for GUID: ${guid}`,
    );
  }

  private parseApiResponse(responseData: any): Partial<DrugPickupPoint>[] {
    try {
      if (!responseData || !responseData.body) {
        this.logger.warn('No body found in API response');
        return [];
      }

      let locationsData;
      try {
        locationsData = JSON.parse(responseData.body);
      } catch (e) {
        this.logger.error(`Failed to parse body JSON: ${(e as Error).message}`);
        return [];
      }

      let locations: any = [];
      if (locationsData.Locations && Array.isArray(locationsData.Locations)) {
        locations = locationsData.Locations;
      } else if (Array.isArray(locationsData)) {
        locations = locationsData;
      } else {
        this.logger.warn('Unexpected data structure in API response');
        return [];
      }

      return locations
        .map((location: any) => {
          let address = '';
          if (location.Address) {
            const parts: any = [];
            if (location.Address.Line1) parts.push(location.Address.Line1);
            if (location.Address.Line2) parts.push(location.Address.Line2);
            if (location.Address.City) parts.push(location.Address.City);
            address = parts.join(', ');
          }

          let contactNumber = '';
          if (location.Telephone && location.Telephone.Number) {
            contactNumber = location.Telephone.Number;
          }

          return {
            name: location.Name || 'Unknown',
            externalId: location.LocationID?.toString() || null,
            address: address || null,
            contactNumber: contactNumber || null,
            isActive: true,
          };
        })
        .filter((point) => point.name && point.name !== 'Unknown');
    } catch (error) {
      this.logger.error(
        `Failed to parse API response: ${(error as Error).message}`,
      );
      throw new Error('Failed to parse API response data');
    }
  }

  async syncPickupPoints(
    externalData: Partial<DrugPickupPoint>[],
  ): Promise<DrugPickupPoint[]> {
    const syncedPoints: Array<DrugPickupPoint> = [];

    for (const data of externalData) {
      let point = await this.pickupPointRepo.findOne({
        where: { externalId: data.externalId },
      });

      if (!point) {
        point = await this.pickupPointRepo.findOne({
          where: { name: data.name },
        });
      }

      if (point) {
        Object.assign(point, data);
      } else {
        point = this.pickupPointRepo.create(data);
      }

      await this.pickupPointRepo.save(point);
      syncedPoints.push(point);
    }

    this.logger.log(`Synced ${syncedPoints.length} pickup points`);
    return syncedPoints;
  }

  /**
   * 🔥 NEW: Look up a hardcoded alias and return the matching DB pickup point
   * This runs BEFORE the fuzzy matcher.
   */
  private lookupAlias(
    normalizedName: string,
    allPoints: DrugPickupPoint[],
  ): DrugPickupPoint | null {
    const targetName = PUP_ALIASES[normalizedName];
    if (!targetName) return null;

    // Find the DB pickup point whose normalized name matches the target
    for (const point of allPoints) {
      const normalizedPointName = this.normalizeString(point.name);
      if (normalizedPointName === targetName) {
        this.logger.debug(
          `🎯 Alias match: "${normalizedName}" → "${point.name}"`,
        );
        return point;
      }
    }

    // Alias exists but the target DB name was not found
    this.logger.warn(
      `⚠️ Alias maps "${normalizedName}" → "${targetName}" but no pickup point with that name was found in the DB`,
    );
    return null;
  }

  /**
   * Find best matching pickup point (SYNCHRONOUS)
   * Priority:
   *   1. Hardcoded alias lookup
   *   2. Fuzzy matching with prefix bonus
   */
  findBestMatchSync(
    name: string,
    pickupPoints: DrugPickupPoint[],
  ): DrugPickupPoint | null {
    if (!name || name.trim() === '') return null;
    if (!pickupPoints || pickupPoints.length === 0) return null;

    const normalizedInput = this.normalizeString(name);

    // 🔥 STEP 1: Try hardcoded alias lookup first
    const aliasMatch = this.lookupAlias(normalizedInput, pickupPoints);
    if (aliasMatch) {
      return aliasMatch;
    }

    // 🔥 STEP 2: Fall back to fuzzy matching
    const inputWords = normalizedInput.split(' ');
    let bestMatch: DrugPickupPoint | null = null;
    let bestScore = 0;

    for (const point of pickupPoints) {
      const normalizedPoint = this.normalizeString(point.name);
      const pointWords = normalizedPoint.split(' ');

      const baseScore = this.calculateSimilarity(
        normalizedInput,
        normalizedPoint,
      );

      let prefixMatchCount = 0;
      for (let i = 0; i < inputWords.length && i < pointWords.length; i++) {
        if (
          inputWords[i] === pointWords[i] ||
          pointWords[i].includes(inputWords[i]) ||
          inputWords[i].includes(pointWords[i])
        ) {
          prefixMatchCount++;
        } else {
          break;
        }
      }

      const prefixRatio =
        inputWords.length > 0 ? prefixMatchCount / inputWords.length : 0;
      const prefixBonus = prefixRatio * 0.3;

      let collectGoBonus = 0;
      if (
        normalizedInput.includes('collect') &&
        normalizedPoint.includes('collect')
      ) {
        collectGoBonus += 0.1;
      }
      if (normalizedInput.includes('go') && normalizedPoint.includes('go')) {
        collectGoBonus += 0.05;
      }

      const finalScore = Math.min(
        baseScore + prefixBonus + collectGoBonus,
        1.0,
      );

      if (finalScore > bestScore && finalScore > 0.5) {
        bestScore = finalScore;
        bestMatch = point;
      }
    }

    if (bestMatch) {
      this.logger.debug(
        `✅ Fuzzy match: "${name}" → "${bestMatch.name}" (score: ${bestScore.toFixed(3)})`,
      );
    } else {
      this.logger.debug(
        `❌ No match found for "${name}" (best score: ${bestScore.toFixed(3)})`,
      );
    }

    return bestMatch;
  }

  /**
   * Async version (kept for other use cases)
   */
  async findBestMatch(name: string): Promise<DrugPickupPoint | null> {
    const all = await this.getAllPickupPoints();
    return this.findBestMatchSync(name, all);
  }

  /**
   * Normalize a string for comparison
   */
  private normalizeString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/'/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const words1 = str1.split(' ');
    const words2 = str2.split(' ');

    if (words1.length === 0 || words2.length === 0) return 0;

    let commonWords = 0;
    const wordSet2 = new Set(words2);

    for (const word of words1) {
      if (wordSet2.has(word)) {
        commonWords++;
      } else {
        for (const word2 of words2) {
          if (
            word.length > 2 &&
            word2.length > 2 &&
            (word.includes(word2) || word2.includes(word))
          ) {
            commonWords += 0.5;
            break;
          }
        }
      }
    }

    const maxLength = Math.max(words1.length, words2.length);
    return Math.min(commonWords / maxLength, 1.0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getAllPickupPoints(): Promise<DrugPickupPoint[]> {
    return await this.pickupPointRepo.find({
      order: { name: 'ASC' },
      where: { isActive: true },
    });
  }

  async findAll(): Promise<DrugPickupPoint[]> {
    return await this.pickupPointRepo.find({
      order: { name: 'ASC' },
      where: { isActive: true },
    });
  }

  async findAllIncludingInactive(): Promise<DrugPickupPoint[]> {
    return await this.pickupPointRepo.find({ order: { name: 'ASC' } });
  }

  async create(data: Partial<DrugPickupPoint>): Promise<DrugPickupPoint> {
    const point = this.pickupPointRepo.create(data);
    return await this.pickupPointRepo.save(point);
  }

  async update(
    id: string,
    data: Partial<DrugPickupPoint>,
  ): Promise<DrugPickupPoint> {
    await this.pickupPointRepo.update(id, data);
    return await this.pickupPointRepo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.pickupPointRepo.update(id, { isActive: false });
  }

  async hardDelete(id: string): Promise<void> {
    await this.pickupPointRepo.delete(id);
  }
}
