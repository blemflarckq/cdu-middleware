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

@Injectable()
export class DrugPickupPointService {
  private readonly logger = new Logger(DrugPickupPointService.name);
  private readonly API_BASE_URL =
    'http://api.bonolohealth.gov.ls/api/Ministry%20of%20Health';

  // Cache for pickup points to avoid repeated DB queries
  private cachedPickupPoints: DrugPickupPoint[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 60 seconds

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
      // Step 1: POST request with GUID
      await this.sendPostRequest(guid);

      // Step 2: Wait for response (polling pattern)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const responseData = await this.pollForResponse(guid);

      // Step 3: Parse and sync the data
      const pickupPoints = this.parseApiResponse(responseData);
      this.logger.log(`Received ${pickupPoints.length} pickup points from API`);

      const synced = await this.syncPickupPoints(pickupPoints);

      // Invalidate cache after sync
      this.invalidateCache();

      return synced;
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

  /**
   * Send POST request to initiate the API call
   */
  private async sendPostRequest(guid: string): Promise<void> {
    const requestBody = {
      Reference: guid,
      Type: 0,
      Method: 'GetLocation',
      Body: '{}',
    };

    this.logger.debug(`Sending POST request with GUID: ${guid}`);
    this.logger.debug(`Request body: ${JSON.stringify(requestBody)}`);

    try {
      const response = await firstValueFrom(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.httpService.post(this.API_BASE_URL, requestBody, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      if (response.status !== 200) {
        throw new Error(`POST request failed with status: ${response.status}`);
      }

      this.logger.debug(`POST request successful for GUID: ${guid}`);
    } catch (error) {
      this.logger.error(`POST request failed: ${(error as Error).message}`);
      throw new Error(
        `Failed to initiate API request: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Poll for the response using GET requests
   */
  private async pollForResponse(
    guid: string,
    maxAttempts: number = 12,
    initialDelay: number = 3000,
  ): Promise<any> {
    this.logger.debug(`Polling for response for GUID: ${guid}`);

    // Initial wait before first poll
    await this.delay(initialDelay);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.API_BASE_URL}/getMessage/${guid}`),
        );

        // Check if we have a valid response with data
        if (
          response.data &&
          response.data.body &&
          response.data.body !== '{}' &&
          response.data.body !== 'null'
        ) {
          this.logger.log(
            `Response received on attempt ${attempt} for GUID: ${guid}`,
          );
          return response.data;
        }

        this.logger.debug(`Attempt ${attempt}: No response yet, waiting...`);

        // Wait before next attempt (increase delay progressively)
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

  /**
   * Parse the API response - extracts locations from the nested body
   */
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

      this.logger.log(`Found ${locations.length} locations in API response`);

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
      this.logger.debug(`Raw response data: ${JSON.stringify(responseData)}`);
      throw new Error('Failed to parse API response data');
    }
  }

  /**
   * Sync pickup points with database
   */
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
        this.logger.debug(`Updating existing pickup point: ${point.name}`);
      } else {
        point = this.pickupPointRepo.create(data);
        this.logger.debug(`Creating new pickup point: ${point.name}`);
      }

      await this.pickupPointRepo.save(point);
      syncedPoints.push(point);
    }

    this.logger.log(`Synced ${syncedPoints.length} pickup points`);

    // Invalidate cache after sync
    this.invalidateCache();

    return syncedPoints;
  }

  /**
   * Invalidate the cache
   */
  private invalidateCache(): void {
    this.cachedPickupPoints = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get all pickup points with caching
   */
  private async getCachedPickupPoints(): Promise<DrugPickupPoint[]> {
    const now = Date.now();
    if (this.cachedPickupPoints && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedPickupPoints;
    }

    // Cache miss - fetch from database
    this.cachedPickupPoints = await this.pickupPointRepo.find({
      order: { name: 'ASC' },
      where: { isActive: true },
    });
    this.cacheTimestamp = now;
    return this.cachedPickupPoints;
  }

  /**
   * Get all pickup points as an array (async)
   */
  async getAllPickupPoints(): Promise<DrugPickupPoint[]> {
    return await this.pickupPointRepo.find({
      order: { name: 'ASC' },
      where: { isActive: true },
    });
  }

  /**
   * Find best matching pickup point by name (SYNCHRONOUS)
   * Uses the provided list of pickup points to match against
   */
  findBestMatchSync(
    name: string,
    pickupPoints: DrugPickupPoint[],
  ): DrugPickupPoint | null {
    if (!name || name.trim() === '') return null;
    if (!pickupPoints || pickupPoints.length === 0) return null;

    const normalizedInput = this.normalizeString(name);
    const inputWords = normalizedInput.split(' ');

    let bestMatch: DrugPickupPoint | null = null;
    let bestScore = 0;

    for (const point of pickupPoints) {
      const normalizedPoint = this.normalizeString(point.name);
      const pointWords = normalizedPoint.split(' ');

      // Calculate base similarity
      const baseScore = this.calculateSimilarity(
        normalizedInput,
        normalizedPoint,
      );

      // Calculate prefix bonus
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

      // Bonus for "Collect&Go" pattern matching
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
        `✅ Best match for "${name}" is "${bestMatch.name}" (score: ${bestScore.toFixed(3)})`,
      );
    }

    return bestMatch;
  }

  /**
   * Find best matching pickup point by name (ASYNCHRONOUS - for other use cases)
   
  async findBestMatch(name: string): Promise<DrugPickupPoint | null> {
    return await this.findBestMatchSync(name);
  }*/

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

  /**
   * Calculate similarity between two strings (0-1)
   */
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

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get all pickup points
   */
  async findAll(): Promise<DrugPickupPoint[]> {
    return await this.pickupPointRepo.find({
      order: { name: 'ASC' },
      where: { isActive: true },
    });
  }

  /**
   * Get all pickup points including inactive
   */
  async findAllIncludingInactive(): Promise<DrugPickupPoint[]> {
    return await this.pickupPointRepo.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Create a new pickup point
   */
  async create(data: Partial<DrugPickupPoint>): Promise<DrugPickupPoint> {
    const point = this.pickupPointRepo.create(data);
    this.invalidateCache();
    return await this.pickupPointRepo.save(point);
  }

  /**
   * Update a pickup point
   */
  async update(
    id: string,
    data: Partial<DrugPickupPoint>,
  ): Promise<DrugPickupPoint> {
    await this.pickupPointRepo.update(id, data);
    this.invalidateCache();
    return await this.pickupPointRepo.findOneOrFail({ where: { id } });
  }

  /**
   * Delete a pickup point (soft delete by setting isActive to false)
   */
  async delete(id: string): Promise<void> {
    await this.pickupPointRepo.update(id, { isActive: false });
    this.invalidateCache();
  }

  /**
   * Hard delete a pickup point (use with caution)
   */
  async hardDelete(id: string): Promise<void> {
    await this.pickupPointRepo.delete(id);
    this.invalidateCache();
  }
}
