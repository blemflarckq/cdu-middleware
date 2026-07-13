/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AxiosError } from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Box } from '../entities/box.entity';
import { Bag } from '../entities/bag.entity';

export interface Customer {
  ContactNumber: string;
  CustomerExternalReference: string;
  IDNumber: string;
  Name: string;
  NextCollectionDate: string;
  Surname: string;
  Title: string;
  DateOfBirth?: string | null;
  GenderType?: string | null;
  FolderNumber?: string | null;
}

export interface TrackingStatus {
  Date: string;
  LocationID: number | string;
  ParcelTrackingStatusID?: string | null;
  TrackingStatusType: number | string;
}

export interface ChildParcel {
  ChildParcels: any[] | null;
  Customer: Customer;
  ExternalReference: string;
  ScheduledDeliveryDate: string;
  LocationID: string;
  ParcelID?: string | null;
  ParcelStatusType: number;
  Pin?: string | null;
  TrackingStatuses: TrackingStatus[];
  Volume?: number | null;
  TemplateID?: string | null;
  ParcelType?: number;
  LinkedExternalReference?: string | null;
  SyNCReference?: string | null;
  FacilityID?: string | null;
}

export interface Parcel {
  ChildParcels: ChildParcel[];
  Customer?: Customer | null;
  ExternalReference: string;
  ScheduledDeliveryDate: string;
  LocationID: string;
  ParcelID?: string | null;
  ParcelStatusType: number;
  Pin?: string | null;
  TrackingStatuses: TrackingStatus[];
  Volume?: number | null;
  TemplateID?: string | null;
  ParcelType?: number;
  LinkedExternalReference?: string | null;
  SyNCReference?: string | null;
  FacilityID?: string | null;
}

export interface LogisticsRequest {
  Parcels: Parcel[];
}

export interface LogisticsResponse {
  message: string | null;
  statusCode: number;
}

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);
  private readonly API_BASE_URL =
    'http://api.bonolohealth.gov.ls/api/Ministry%20of%20Health';

  constructor(
    private httpService: HttpService,
    @InjectRepository(Box)
    private boxRepo: Repository<Box>,
  ) {}

  /**
   * Send box and its bags to logistics system with status tracking
   */
  async sendBoxToLogistics(
    boxId: string,
    retryCount: number = 0,
  ): Promise<LogisticsResponse> {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
      relations: ['bags', 'bags.patientRecord', 'drugPickupPoint'],
    });

    if (!box) {
      throw new Error(`Box with ID ${boxId} not found`);
    }
    /*
    if (box.status !== 'CLOSED' && box.status !== 'FAILED') {
      throw new Error(
        `Box ${box.boxNumber} must be CLOSED or FAILED to send (current: ${box.status})`,
      );
    }*/

    const bags = box.bags || [];
    const box_volume = bags.length * 20;
    if (bags.length === 0) {
      throw new Error(`Box ${box.boxNumber} has no bags to send`);
    }

    const guid = uuidv4();
    this.logger.log(
      `Sending box ${box.boxNumber} to logistics with GUID: ${guid}, attempt: ${retryCount + 1}`,
    );

    // Update box with tracking info
    box.logisticsReference = guid;
    box.logisticsStatus = 'PROCESSING';
    box.logisticsAttempts = (box.logisticsAttempts || 0) + 1;
    await this.boxRepo.save(box);

    try {
      // Build bag data
      const bagData = bags.map((bag) => {
        const record = bag.patientRecord;

        let nextPickupDate = new Date().toISOString();
        if (record?.nextDrugPickupDate) {
          if (record.nextDrugPickupDate instanceof Date) {
            nextPickupDate = record.nextDrugPickupDate.toISOString();
          } else if (typeof record.nextDrugPickupDate === 'string') {
            nextPickupDate = new Date(record.nextDrugPickupDate).toISOString();
          }
        }

        return {
          bagBarcode: bag.barcode,
          patient: {
            ContactNumber: record?.primaryContact || '',
            CustomerExternalReference: record?.primaryContact || '',
            IDNumber: record?.patientUniqueId || '',
            Name: record?.firstName || '',
            NextCollectionDate: nextPickupDate,
            Surname: record?.lastName || '',
            Title: record?.gender === 'F' ? 'Ms' : 'Mr',
            DateOfBirth: null,
            GenderType: record?.gender === 'F' ? 'Female' : 'Male',
            FolderNumber: null,
          },
          scheduledDeliveryDate: nextPickupDate,
        };
      });

      // 🔧 FIX: Use externalId from drugPickupPoint, not the internal ID
      const locationExternalId = box.drugPickupPoint?.externalId || '611';
      this.logger.log(
        `Using location external ID: ${locationExternalId} for pickup point: ${box.drugPickupPoint?.name}`,
      );

      const childParcels: ChildParcel[] = bagData.map((bag) => ({
        ChildParcels: null,
        Customer: bag.patient,
        ExternalReference: bag.bagBarcode,
        ScheduledDeliveryDate: bag.scheduledDeliveryDate,
        LocationID: locationExternalId, // ← Use external ID here
        ParcelID: null,
        ParcelStatusType: 0,
        Pin: null,
        TrackingStatuses: [
          {
            Date: new Date().toISOString(),
            LocationID: 1, // ← This stays as 1 for tracking status
            ParcelTrackingStatusID: null,
            TrackingStatusType: 'ReadyForDispatch',
          },
        ],
        Volume: null,
        TemplateID: null,
        ParcelType: 0,
      }));

      const parcels: Parcel[] = [
        {
          ChildParcels: childParcels,
          Customer: null,
          ExternalReference: box.boxNumber,
          ScheduledDeliveryDate:
            bagData[0]?.scheduledDeliveryDate || new Date().toISOString(),
          LocationID: locationExternalId, // ← Use external ID here too
          ParcelID: null,
          ParcelStatusType: 0,
          Pin: null,
          TrackingStatuses: [
            {
              Date: new Date().toISOString(),
              LocationID: 1, // ← This stays as 1 for tracking status
              ParcelTrackingStatusID: null,
              TrackingStatusType: 'ReadyForDispatch',
            },
          ],
          Volume: box_volume,
          TemplateID: null,
        },
      ];
      this.logger.log(`The current has a total voluemt of : ${box_volume}`);

      const requestBody: LogisticsRequest = { Parcels: parcels };

      await this.sendPostRequest(guid, requestBody);

      box.logisticsStatus = 'PENDING_CONFIRMATION';
      await this.boxRepo.save(box);

      // Poll for response (don't await, let it run in background)
      this.pollForResponse(guid, box.id).catch((err) => {
        this.logger.error(
          `Background polling failed for box ${box.boxNumber}: ${err.message}`,
        );
      });

      this.logger.log(`Successfully sent box ${box.boxNumber} to logistics`);
      return { message: null, statusCode: 200 };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send box ${box.boxNumber}: ${errorMessage}`);

      // Auto-retry logic (max 3 attempts)
      const maxRetries = 3;
      if (retryCount < maxRetries) {
        this.logger.log(
          `Auto-retrying box ${box.boxNumber} (attempt ${retryCount + 2} of ${maxRetries + 1})...`,
        );
        const delayMs = Math.pow(2, retryCount) * 5000;
        await this.delay(delayMs);

        box.logisticsStatus = 'RETRYING';
        await this.boxRepo.save(box);

        return this.sendBoxToLogistics(boxId, retryCount + 1);
      }

      box.logisticsStatus = 'FAILED';
      box.logisticsLastError = errorMessage;
      await this.boxRepo.save(box);

      throw error;
    }
  }

  /**
   * Send POST request to initiate the API call
   */
  private async sendPostRequest(
    guid: string,
    data: LogisticsRequest,
  ): Promise<void> {
    const requestBody = {
      Reference: guid,
      Type: 0,
      Method: 'UpdateParcel',
      Body: JSON.stringify(data),
    };

    this.logger.debug(`Sending POST request with GUID: ${guid}`);
    this.logger.debug(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    try {
      const response = await firstValueFrom(
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
      let errorMessage = 'Unknown error occurred';

      if (error instanceof AxiosError) {
        errorMessage = `Axios error: ${error.message}`;
        this.logger.error(`POST request failed: ${error.message}`);
      } else if (error instanceof Error) {
        errorMessage = error.message;
        this.logger.error(`POST request failed: ${error.message}`);
      } else {
        this.logger.error(`POST request failed: Unknown error`);
      }

      throw new Error(
        `Failed to initiate logistics API request: ${errorMessage}`,
      );
    }
  }

  /**
   * Poll for the response using GET requests and update box status
   */
  private async pollForResponse(
    guid: string,
    boxId: string,
    maxAttempts: number = 12,
    initialDelay: number = 3000,
  ): Promise<any> {
    this.logger.debug(`Polling for response for GUID: ${guid}`);

    await this.delay(initialDelay);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.API_BASE_URL}/getMessage/${guid}`),
        );

        // Check if we have a valid response
        if (response.data && response.data.body) {
          this.logger.log(
            `Response received on attempt ${attempt} for GUID: ${guid}`,
          );

          // Parse and verify the response
          const parsedBody = JSON.parse(response.data.body);
          if (parsedBody.Parcels && parsedBody.Parcels.length > 0) {
            // Update box as successfully sent
            await this.boxRepo.update(boxId, {
              logisticsStatus: 'SENT',
              logisticsSentAt: new Date(),
              logisticsResponse: response.data,
              status: 'SENT',
            });
            this.logger.log(
              `Box ${boxId} successfully confirmed by logistics system`,
            );
            return response.data;
          }
        }

        this.logger.debug(
          `Attempt ${attempt}: No valid response yet, waiting...`,
        );
        await this.delay(initialDelay * attempt);
      } catch (error) {
        let errorMessage = 'Unknown error occurred';

        if (error instanceof AxiosError) {
          errorMessage = error.message;
          this.logger.debug(`Attempt ${attempt} failed: ${error.message}`);
        } else if (error instanceof Error) {
          errorMessage = error.message;
          this.logger.debug(`Attempt ${attempt} failed: ${error.message}`);
        } else {
          this.logger.debug(`Attempt ${attempt} failed: Unknown error`);
        }

        await this.delay(initialDelay);
      }
    }

    // If we get here, polling failed - update status
    this.logger.warn(
      `Failed to get response for GUID ${guid} after ${maxAttempts} attempts`,
    );
    await this.boxRepo.update(boxId, {
      logisticsStatus: 'PENDING_CONFIRMATION',
      logisticsLastError: 'Awaiting logistics system confirmation',
    });
  }

  /**
   * Get logistics status for a box
   */
  async getBoxLogisticsStatus(boxId: string): Promise<any> {
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
      throw new Error(`Box with ID ${boxId} not found`);
    }

    return box;
  }

  /**
   * Check status of a logistics request manually
   */
  async getLogisticsStatus(reference: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.API_BASE_URL}/getMessage/${reference}`),
      );

      return {
        reference,
        status: 'COMPLETED',
        data: response.data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        reference,
        status: 'PENDING',
        error: errorMessage,
      };
    }
  }

  /**
   * Retry a failed box
   */
  async retryFailedBox(boxId: string): Promise<LogisticsResponse> {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
    });

    if (!box) {
      throw new Error(`Box ${boxId} not found`);
    }
    /*
    if (box.logisticsStatus === 'SENT') {
      throw new Error(
        `Box ${box.boxNumber} is not in FAILED state (current: ${box.logisticsStatus})`,
      );
    }*/

    // Reset and retry
    box.logisticsStatus = 'PENDING';
    box.logisticsLastError = '';
    await this.boxRepo.save(box);

    return this.sendBoxToLogistics(boxId);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
