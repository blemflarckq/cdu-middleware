/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);
  private readonly TSC_IP = process.env.TSC_PRINTER_IP || '192.168.26.43';
  private readonly TSC_PORT = parseInt(
    process.env.TSC_PRINTER_PORT || '9100',
    10,
  );
  private readonly HP_IP = process.env.HP_PRINTER_IP || '192.168.26.41';
  private readonly HP_PORT = parseInt(
    process.env.HP_PRINTER_PORT || '9100',
    10,
  );
  private readonly ZEBRA_IP = process.env.ZEBRA_PRINTER_IP || '192.168.26.44';
  private readonly ZEBRA_PORT = parseInt(
    process.env.ZEBRA_PRINTER_PORT || '9100',
    10,
  );

  // ==================== CONNECTION TEST ====================

  /**
   * Test printer connectivity
   */
  async testPrinterConnection(
    printerType: 'tsc' | 'hp' | 'zebra',
  ): Promise<boolean> {
    let ip: string;
    let port: number;

    switch (printerType) {
      case 'tsc':
        ip = this.TSC_IP;
        port = this.TSC_PORT;
        break;
      case 'hp':
        ip = this.HP_IP;
        port = this.HP_PORT;
        break;
      case 'zebra':
        ip = this.ZEBRA_IP;
        port = this.ZEBRA_PORT;
        break;
    }

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

  // ==================== TSC - BAG LABEL ====================

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

    const isConnected = await this.testPrinterConnection('tsc');
    if (!isConnected) {
      this.logger.error('TSC printer not reachable');
      return false;
    }

    const zpl = this.generateBagLabelZPL(data);
    return this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
  }

  private generateBagLabelZPL(data: any): string {
    const widthDots = Math.round(4.13 * 203); // 838 dots
    const heightDots = Math.round(2.07 * 203); // 420 dots

    return `^XA
^PW${widthDots}
^LL${heightDots}
^CF0,18
^FO20,15^BY2^BCN,45,Y,N,N^FD>;${data.barcode}^FS
^FO20,70^A0N,14,14^FD${this.truncate(data.patientName + ' ' + data.patientSurname, 30)}^FS
^FO20,100^A0N,10,10^FDCol: ${data.collectionDate}^FS
^FO20,120^A0N,10,10^FDPick: ${this.truncate(data.pickupPoint, 35)}^FS
^XZ`;
  }

  // ==================== TSC - BOX LABEL ====================

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

    const zpl = this.generateBoxLabelZPL(data);
    return this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
  }

  private generateBoxLabelZPL(data: any): string {
    const widthDots = Math.round(4.13 * 203);
    const heightDots = Math.round(2.07 * 203);

    return `^XA
^PW${widthDots}
^LL${heightDots}
^CF0,20
^FO20,15^BY3^BCN,55,Y,N,N^FD>;${data.barcode}^FS
^FO20,80^A0N,12,12^FDCol: ${data.collectionDate}^FS
^FO20,110^A0N,12,12^FDPick: ${this.truncate(data.pickupPoint, 28)}^FS
^FO20,140^A0N,10,10^FDMedication Parcels^FS
^XZ`;
  }

  // ==================== TSC - PRODUCT LABEL ====================

  /**
   * Print Product Label (for bottle side)
   * 🔧 REMOVED: "Bottle X of Y" text
   */
  async printProductLabel(data: {
    patientName: string;
    regimen: string;
    dosageInstructions: string;
    bottleNumber: number;
    totalBottles: number;
  }): Promise<boolean> {
    this.logger.log(`Printing product label for: ${data.patientName}`);

    const isConnected = await this.testPrinterConnection('tsc');
    if (!isConnected) {
      this.logger.error('TSC printer not reachable');
      return false;
    }

    const zpl = this.generateProductLabelZPL(data);
    return this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
  }

  private generateProductLabelZPL(data: any): string {
    // Product label - smaller format for bottle side
    const widthDots = Math.round(3.0 * 203); // 3.0 inches width
    const heightDots = Math.round(2.0 * 203); // 2.0 inches height

    return `^XA
^PW${widthDots}
^LL${heightDots}
^CF0,16
^FO20,20^A0N,16,16^FDPrescription^FS
^FO20,50^A0N,12,12^FD${this.truncate(data.regimen, 30)}^FS
^FO20,85^A0N,12,12^FDPatient: ${this.truncate(data.patientName, 28)}^FS
^FO20,120^A0N,10,10^FDDosage:^FS
^FO20,145^A0N,10,10^FD${this.truncate(data.dosageInstructions, 35)}^FS
^XZ`;
  }

  // ==================== HP - BOX MANIFEST ====================

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

  private generateManifestHTML(data: any): string {
    const now = new Date().toLocaleString();
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Box Manifest - ${data.boxNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 15mm; font-size: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .header h1 { font-size: 20px; margin: 0; }
    .header p { margin: 5px 0 0 0; font-size: 12px; color: #555; }
    .box-info { background: #f5f5f5; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; }
    .box-info div { margin-bottom: 6px; }
    .box-info strong { display: inline-block; min-width: 130px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 11px; }
    th { background: #333; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #ccc; text-align: center; font-size: 10px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>COLLECT-N-GO BOX MANIFEST</h1>
    <p>Pharmacy Logistics &amp; Dispensing</p>
  </div>

  <div class="box-info">
    <div><strong>Box Number:</strong> ${data.boxNumber}</div>
    <div><strong>Destination:</strong> ${data.destinationLocation}</div>
    <div><strong>Collection Date:</strong> ${data.collectionDate}</div>
    <div><strong>Total Items:</strong> ${data.totalItems}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Patient Name</th>
        <th style="width: 130px;">Patient ID</th>
        <th>Regimen</th>
      </tr>
    </thead>
    <tbody>
      ${data.items
        .map(
          (item: any, idx: number) => `
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
    <p>Generated by Collect-N-Go System | ${now}</p>
    <p>Please verify contents before sealing</p>
  </div>
</body>
</html>`;
  }

  // ==================== ZEBRA - DISPENSING SLIP ====================

  /**
   * Print Dispensing Slip on Zebra printer
   * Uses ZPL commands (Zebra's native language)
   */
  async printDispensingSlip(data: {
    patientName: string;
    patientId: string;
    regimen: string;
    dosageInstructions: string;
    collectionLocation: string;
    collectionDate: string;
    numberOfBottles: number;
    bagBarcode: string;
  }): Promise<boolean> {
    this.logger.log(`Printing dispensing slip for: ${data.patientName}`);

    const isConnected = await this.testPrinterConnection('zebra');
    if (!isConnected) {
      this.logger.error('Zebra printer not reachable');
      return false;
    }

    const zpl = this.generateDispensingSlipZPL(data);
    return this.sendToPrinter(this.ZEBRA_IP, this.ZEBRA_PORT, zpl);
  }

  private generateDispensingSlipZPL(data: any): string {
    // Zebra label size - adjust based on your slip media
    // Default: 4" x 6" at 203 dpi = 812 x 1218 dots
    const widthDots = 812;
    const heightDots = 1218;

    return `^XA
^PW${widthDots}
^LL${heightDots}

^CF0,30
^FO30,30^A0N,30,30^FDCOLLECT-N-GO^FS
^FO30,65^A0N,18,18^FDDispensing Slip^FS
^FO30,95^GB750,2,2^FS

^CF0,22
^FO30,115^A0N,22,22^FDPatient: ${this.truncate(data.patientName, 40)}^FS
^FO30,150^A0N,22,22^FDPatient ID: ${data.patientId}^FS

^FO30,195^GB750,2,2^FS
^CF0,24
^FO30,215^A0N,24,24^FDRegimen^FS
^CF0,20
^FO30,250^A0N,20,20^FD${this.truncate(data.regimen, 50)}^FS

^FO30,290^GB750,2,2^FS
^CF0,24
^FO30,310^A0N,24,24^FDDosage Instructions^FS
^CF0,20
^FO30,345^A0N,20,20^FD${this.truncate(data.dosageInstructions, 50)}^FS

^FO30,395^GB750,2,2^FS
^CF0,22
^FO30,415^A0N,22,22^FDBottles Dispensed: ${data.numberOfBottles}^FS

^FO30,455^GB750,2,2^FS
^CF0,22
^FO30,475^A0N,22,22^FDCollection Location:^FS
^CF0,20
^FO30,510^A0N,20,20^FD${this.truncate(data.collectionLocation, 50)}^FS

^FO30,550^GB750,2,2^FS
^CF0,22
^FO30,570^A0N,22,22^FDCollection Date: ${data.collectionDate}^FS

^FO30,615^GB750,2,2^FS
^FO30,635^BY2^BCN,80,Y,N,N^FD>;${data.bagBarcode}^FS
^FO30,730^A0N,18,18^FDBag: ${data.bagBarcode}^FS

^FO30,780^GB750,2,2^FS
^CF0,18
^FO30,800^A0N,18,18^FDPrinted: ${new Date().toLocaleString()}^FS

^FO30,850^GB750,2,2^FS
^CF0,20
^FO30,870^A0N,20,20^FDThank you. Please keep this slip.^FS

^XZ`;
  }

  // ==================== HELPERS ====================

  private truncate(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private async sendToPrinter(
    ip: string,
    port: number,
    data: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          client.destroy();
          this.logger.error(`Printer timeout: ${ip}:${port}`);
          resolve(false);
        }
      }, 10000);

      client.connect(port, ip, () => {
        client.write(data);
        client.end();
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          this.logger.log(`Print job sent successfully to ${ip}:${port}`);
          resolve(true);
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          this.logger.error(`Printer error ${ip}:${port} - ${err.message}`);
          resolve(false);
        }
      });
    });
  }
}
