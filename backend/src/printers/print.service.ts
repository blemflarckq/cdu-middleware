/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/print/print.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as net from 'net';
import { Box } from '../entities/box.entity';
import { Repository } from 'typeorm';

export interface BagLabelData {
  type: 'bag';
  barcode: string;
  patientName: string;
  patientSurname: string;
  collectionDate: string;
  pickupPoint: string;
}

export interface BoxLabelData {
  type: 'box';
  barcode: string;
  collectionDate: string;
  pickupPoint: string;
}

export interface ManifestData {
  boxNumber: string;
  destinationLocation: string;
  items: Array<{
    patientName: string;
    patientId: string;
    regimen: string;
  }>;
  totalItems: number;
  collectionDate: string;
}

@Injectable()
export class PrintService {
  constructor(
    @InjectRepository(Box)
    private boxRepo: Repository<Box>,
  ) {}
  private readonly logger = new Logger(PrintService.name);
  private readonly TSC_IP = '192.168.26.43';
  private readonly TSC_PORT = 9100; // Default TSC printer port
  private readonly HP_IP = '192.168.26.41';
  private readonly HP_PORT = 9100; // Default HP printer port

  /**
   * Test printer connectivity
   */
  async testPrinterConnection(printerType: 'tsc' | 'hp'): Promise<boolean> {
    const ip = printerType === 'tsc' ? this.TSC_IP : this.HP_IP;
    const port = printerType === 'tsc' ? this.TSC_PORT : this.HP_PORT;

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        this.logger.error(
          `${printerType.toUpperCase()} printer connection timeout`,
        );
        resolve(false);
      }, 3000);

      socket.connect(port, ip, () => {
        clearTimeout(timeout);
        socket.destroy();
        this.logger.log(
          `${printerType.toUpperCase()} printer connected successfully`,
        );
        resolve(true);
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        this.logger.error(
          `${printerType.toUpperCase()} printer connection error: ${err.message}`,
        );
        resolve(false);
      });
    });
  }

  /**
   * Print Bag Label on TSC Printer
   */
  async printBagLabel(data: {
    type: 'bag';
    barcode: string;
    patientName: string;
    patientSurname: string;
    collectionDate: string;
    pickupPoint: string;
  }): Promise<boolean> {
    this.logger.log(
      `Printing bag label for: ${data.patientName} ${data.patientSurname}`,
    );

    // Check connectivity first
    const isConnected = await this.testPrinterConnection('tsc');
    if (!isConnected) {
      this.logger.error('TSC printer not reachable');
      return false;
    }

    const zpl = this.generateBagLabelZPL(data);
    return this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
  }

  /**
   * Print Box Label on TSC Printer
   */
  async printBoxLabel(data: {
    type: 'box';
    barcode: string;
    collectionDate: string;
    pickupPoint: string;
  }): Promise<boolean> {
    this.logger.log(`Printing box label for: ${data.barcode}`);

    const isConnected = await this.testPrinterConnection('tsc');
    if (!isConnected) {
      this.logger.error('TSC printer not reachable');
      return false;
    }

    const zpl = this.generateBox1LabelZPL(data);
    return this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
  }

  async printProductLabel(data: {
    patientName: string;
    regimen: string;
    dosageInstructions: string;
    bottleNumber: number;
    totalBottles: number;
  }): Promise<boolean> {
    this.logger.log(
      `Printing product label for: ${data.patientName} (bottle ${data.bottleNumber}/${data.totalBottles})`,
    );

    const isConnected = await this.testPrinterConnection('tsc');
    if (!isConnected) {
      this.logger.error('TSC printer not reachable');
      return false;
    }

    const zpl = this.generateProductLabelZPL(data);
    return this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
  }

  async reprintBoxLabel(boxId: string) {
    const box = await this.boxRepo.findOneOrFail({
      where: { id: boxId },
      relations: ['drugPickupPoint'],
    });

    if (!box) {
      throw new Error('Box not found');
    }

    const boxLabelData = {
      type: 'box' as const,
      barcode: box.boxNumber,
      collectionDate: box.collectionDate || new Date().toLocaleDateString(),
      pickupPoint: box.destinationLocation || 'Unknown',
    };

    try {
      await this.printBoxLabel(boxLabelData);
      this.logger.log(`✅ Box label reprinted for: ${box.boxNumber}`);
      return {
        success: true,
        message: `Box label reprinted for ${box.boxNumber}`,
        boxNumber: box.boxNumber,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`❌ Failed to reprint box label: ${errorMessage}`);
      throw new Error(`Failed to reprint box label: ${errorMessage}`);
    }
  }

  /**
   * Print Manifest on HP LaserJet
   */
  async printManifest(data: {
    boxNumber: string;
    destinationLocation: string;
    items: Array<{ patientName: string; patientId: string; regimen: string }>;
    totalItems: number;
    collectionDate: string;
  }): Promise<boolean> {
    this.logger.log(`Printing manifest for box: ${data.boxNumber}`);

    const isConnected = await this.testPrinterConnection('hp');
    if (!isConnected) {
      this.logger.error('HP printer not reachable');
      return false;
    }

    const html = this.generateManifestHTML(data);
    return this.sendToPrinter(this.HP_IP, this.HP_PORT, html);
  }

  private generateBagLabelZPL(data: any): string {
    const widthDots = Math.round(104.75 * 8); // 838 dots
    const heightDots = Math.round(52.41 * 8); // 419 dots

    return `^XA
^PW${widthDots}
^LL${heightDots}
^FO40,40^BCB,50,N,N,N^FD${data.barcode}^FS
^FO100,40^A0B,22,22^FD${data.barcode}^FS
^FO135,40^A0B,26,26^FD${data.patientName} ${data.patientSurname}^FS
^FO175,40^A0B,22,22^FD${data.collectionDate}^FS
^FO210,40^A0B,22,22^FD${this.truncate(data.pickupPoint, 40)}^FS
^XZ`;
  }

  private generateBox1LabelZPL(data: any): string {
    const widthDots = Math.round(104.75 * 8); // 838 dots
    const heightDots = Math.round(52.41 * 8); // 419 dots

    return `^XA
^PW${widthDots}
^LL${heightDots}
^FO40,40^BCB,50,N,N,N^FD${data.barcode}^FS
^FO100,40^A0B,22,22^FD${data.barcode}^FS
^FO135,40^A0B,22,22^FD${data.collectionDate}^FS
^FO175,40^A0B,22,22^FD${this.truncate(data.pickupPoint, 40)}^FS
^FO210,40^A0B,22,22^FDMedication Parcels^FS
^XZ`;
  }

  private generateProductLabelZPL(data: any): string {
    // Product label - smaller format for bottle side
    const widthDots = Math.round(104.75 * 8); // 838 dots
    const heightDots = Math.round(52.41 * 8); // 419 dots

    return `^XA
^PW${widthDots}
^LL${heightDots}
^CF0,16
^FO40,40^A0B,22,22^FDPrescription: ${data.regimen}^FS
^FO100,40^A0B,22,22^FDPatient: ${data.patientName}^FS
^FO135,40^A0B,122,22^FDBottle: ${data.bottleNumber} of ${data.totalBottles}^FS
^FO175,40^A0B,22,22^FDDosage: ${this.truncate(data.dosageInstructions, 35)}^FS
^XZ`;
  }

  private truncate(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate HTML for Manifest
   */
  private generateManifestHTML(data: ManifestData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Box Manifest - ${data.boxNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20mm;
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header h1 {
            font-size: 18px;
            margin: 0;
          }
          .box-info {
            margin: 20px 0;
            padding: 10px;
            background: #f0f0f0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>COLLECT-N-GO BOX MANIFEST</h1>
          <p>Pharmacy Logistics & Dispensing</p>
        </div>
        
        <div class="box-info">
          <strong>Box Number:</strong> ${data.boxNumber}<br>
          <strong>Destination:</strong> ${data.destinationLocation}<br>
          <strong>Collection Date:</strong> ${data.collectionDate}<br>
          <strong>Total Items:</strong> ${data.totalItems}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Patient Name</th>
              <th>Patient ID</th>
              <th>Regimen</th>
            </tr>
          </thead>
          <tbody>
            ${data.items
              .map(
                (item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.patientName}</td>
                <td>${item.patientId}</td>
                <td>${item.regimen}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Generated by Collect-N-Go System | ${new Date().toLocaleString()}</p>
          <p>Please verify contents before sealing</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send data to printer via TCP
   */
  private async sendToPrinter(
    ip: string,
    port: number,
    data: string | Buffer,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();

      client.connect(port, ip, () => {
        client.write(data);
        client.end();
        resolve(true);
      });

      client.on('error', (err) => {
        console.error(`Printer error at ${ip}:`, err);
        resolve(false);
      });

      client.on('timeout', () => {
        client.destroy();
        console.error(`Printer timeout at ${ip}`);
        resolve(false);
      });

      client.setTimeout(10000);
    });
  }

  /**
   * Convert HTML to PDF (using puppeteer or similar)
   * Note: You'll need to install puppeteer: npm install puppeteer
   */
  private htmlToPdf(html: string): Buffer {
    // For simplicity, we'll return a Buffer of the HTML
    // In production, use puppeteer or a PDF generation library
    return Buffer.from(html, 'utf-8');
  }
}
