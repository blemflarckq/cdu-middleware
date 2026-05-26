/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AxiosError } from 'axios';

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

  constructor(private httpService: HttpService) {}

  /**
   * Send box and its bags to logistics system
   */
  async sendBoxToLogistics(
    boxNumber: string,
    locationId: string,
    bags: Array<{
      bagBarcode: string;
      patient: Customer;
      scheduledDeliveryDate: string;
    }>,
  ): Promise<LogisticsResponse> {
    const guid = uuidv4();
    this.logger.log(`Sending box ${boxNumber} to logistics with GUID: ${guid}`);
    this.logger.log(`Box contains ${bags.length} bags`);

    try {
      // Build the child parcels (bags)
      const childParcels: ChildParcel[] = bags.map((bag, index) => ({
        ChildParcels: null,
        Customer: bag.patient,
        ExternalReference: bag.bagBarcode,
        ScheduledDeliveryDate: bag.scheduledDeliveryDate,
        LocationID: locationId,
        ParcelID: null,
        ParcelStatusType: 0, // Active
        Pin: null,
        TrackingStatuses: [
          {
            Date: new Date().toISOString(),
            LocationID: 1,
            ParcelTrackingStatusID: null,
            TrackingStatusType: 0, // ReadyForDispatch
          },
        ],
        Volume: null,
        TemplateID: null,
        ParcelType: 0,
      }));

      // Build the parent parcel (box)
      const parcels: Parcel[] = [
        {
          ChildParcels: childParcels,
          Customer: null,
          ExternalReference: boxNumber,
          ScheduledDeliveryDate:
            bags[0]?.scheduledDeliveryDate || new Date().toISOString(),
          LocationID: locationId,
          ParcelID: null,
          ParcelStatusType: 0, // Active
          Pin: null,
          TrackingStatuses: [
            {
              Date: new Date().toISOString(),
              LocationID: 1,
              ParcelTrackingStatusID: null,
              TrackingStatusType: 0, // ReadyForDispatch
            },
          ],
          Volume: 20,
          TemplateID: null,
        },
      ];

      const requestBody: LogisticsRequest = { Parcels: parcels };

      // Send POST request
      await this.sendPostRequest(guid, requestBody);

      // Poll for response
      await this.pollForResponse(guid);

      this.logger.log(`Successfully sent box ${boxNumber} to logistics`);
      return { message: null, statusCode: 200 };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send box to logistics: ${errorMessage}`);
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
   * Poll for the response using GET requests
   */
  private async pollForResponse(
    guid: string,
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

    throw new Error(
      `No response received after ${maxAttempts} attempts for GUID: ${guid}`,
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
