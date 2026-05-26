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
      // The response has a structure: { reference, type, method, body }
      // where body is a JSON string containing the Locations array

      if (!responseData || !responseData.body) {
        this.logger.warn('No body found in API response');
        return [];
      }

      // Parse the body string to get the actual data
      let locationsData;
      try {
        locationsData = JSON.parse(responseData.body);
      } catch (e) {
        this.logger.error(`Failed to parse body JSON: ${(e as Error).message}`);
        return [];
      }

      // Extract the Locations array
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

      // Map the locations to our PickupPoint structure
      return locations
        .map((location: any) => {
          // Extract address components
          let address = '';
          if (location.Address) {
            const parts: any = [];
            if (location.Address.Line1) parts.push(location.Address.Line1);
            if (location.Address.Line2) parts.push(location.Address.Line2);
            if (location.Address.City) parts.push(location.Address.City);
            address = parts.join(', ');
          }

          // Extract phone number
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
        // Try to find by name (case-insensitive)
        point = await this.pickupPointRepo.findOne({
          where: { name: data.name },
        });
      }

      if (point) {
        // Update existing
        Object.assign(point, data);
        this.logger.debug(`Updating existing pickup point: ${point.name}`);
      } else {
        // Create new
        point = this.pickupPointRepo.create(data);
        this.logger.debug(`Creating new pickup point: ${point.name}`);
      }

      await this.pickupPointRepo.save(point);
      syncedPoints.push(point);
    }

    this.logger.log(`Synced ${syncedPoints.length} pickup points`);
    return syncedPoints;
  }

  /**
   * Find best matching pickup point by name with prefix bonus
   * Prioritizes matches where input words appear at the beginning of the point name
   */
  async findBestMatch(name: string): Promise<DrugPickupPoint | null> {
    if (!name || name.trim() === '') return null;

    const allPoints = await this.pickupPointRepo.find();
    const normalizedInput = this.normalizeString(name);
    const inputWords = normalizedInput.split(' ');

    this.logger.debug(
      `Looking for match: "${name}" -> normalized: "${normalizedInput}"`,
    );

    let bestMatch: DrugPickupPoint | null = null;
    let bestScore = 0;

    for (const point of allPoints) {
      const normalizedPoint = this.normalizeString(point.name);
      const pointWords = normalizedPoint.split(' ');

      // Calculate base similarity
      const baseScore = this.calculateSimilarity(
        normalizedInput,
        normalizedPoint,
      );

      // Calculate prefix bonus: how many input words match the beginning of the point name
      let prefixMatchCount = 0;
      for (let i = 0; i < inputWords.length && i < pointWords.length; i++) {
        if (
          inputWords[i] === pointWords[i] ||
          pointWords[i].includes(inputWords[i]) ||
          inputWords[i].includes(pointWords[i])
        ) {
          prefixMatchCount++;
        } else {
          break; // Stop at first mismatch
        }
      }

      // Calculate prefix ratio and bonus (up to 0.3 extra)
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

      // Calculate final score
      let finalScore = baseScore + prefixBonus + collectGoBonus;
      finalScore = Math.min(finalScore, 1.0); // Cap at 1.0

      this.logger.debug(
        `Point: "${point.name}" - Base: ${baseScore.toFixed(3)}, Prefix: ${prefixBonus.toFixed(3)}, Bonus: ${collectGoBonus}, Final: ${finalScore.toFixed(3)}`,
      );

      if (finalScore > bestScore && finalScore > 0.5) {
        // 50% threshold
        bestScore = finalScore;
        bestMatch = point;
      }
    }

    if (bestMatch) {
      this.logger.debug(
        `✅ Best match for "${name}" is "${bestMatch.name}" (score: ${bestScore.toFixed(3)})`,
      );
    } else {
      this.logger.debug(
        `❌ No match found for "${name}" (best score: ${bestScore.toFixed(3)})`,
      );
    }

    return bestMatch;
  }

  /**
   * Calculate direct similarity between two strings (Levenshtein-inspired)
   */
  private calculateDirectSimilarity(str1: string, str2: string): number {
    // Check if one string contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.9;
    }

    // Simple character-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    // Count matching characters (simple approximation)
    let matches = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) matches++;
    }

    return matches / maxLen;
  }

  /**
   * Normalize a string for comparison - preserves meaningful special characters
   */
  private normalizeString(str: string): string {
    if (!str) return '';

    // Convert to lowercase
    const normalized = str
      .toLowerCase()
      // Replace ampersand with 'and' for better matching
      .replace(/&/g, ' and ')
      // Remove apostrophes
      .replace(/'/g, '')
      // Replace other special characters with spaces
      .replace(/[^a-z0-9\s]/g, ' ')
      // Collapse multiple spaces
      .trim()
      .replace(/\s+/g, ' ');

    return normalized;
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const words1 = str1.split(' ');
    const words2 = str2.split(' ');

    if (words1.length === 0 || words2.length === 0) return 0;

    // Count common words
    let commonWords = 0;
    const wordSet2 = new Set(words2);

    for (const word of words1) {
      if (wordSet2.has(word)) {
        commonWords++;
      } else {
        // Check for partial word matches
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

    // Use the longer word count as denominator
    const maxLength = Math.max(words1.length, words2.length);
    const score = commonWords / maxLength;

    return Math.min(score, 1.0);
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
    return await this.pickupPointRepo.findOneOrFail({ where: { id } });
  }

  /**
   * Delete a pickup point (soft delete by setting isActive to false)
   */
  async delete(id: string): Promise<void> {
    await this.pickupPointRepo.update(id, { isActive: false });
  }

  /**
   * Hard delete a pickup point (use with caution)
   */
  async hardDelete(id: string): Promise<void> {
    await this.pickupPointRepo.delete(id);
  }
}
