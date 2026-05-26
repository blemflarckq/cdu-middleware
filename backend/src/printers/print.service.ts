// src/print/print.service.ts
import { Injectable } from '@nestjs/common';
import * as net from 'net';

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
  private readonly TSC_IP = '192.168.26.43';
  private readonly TSC_PORT = 9100; // Default TSC printer port
  private readonly HP_IP = '192.168.26.41';
  private readonly HP_PORT = 9100; // Default HP printer port

  /**
   * Print Bag Label on TSC Printer
   */
  async printBagLabel(data: BagLabelData): Promise<void> {
    const zpl = this.generateBagLabelZPL(data);
    await this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
    console.log(
      `✅ Bag label printed for: ${data.patientName} ${data.patientSurname}`,
    );
  }

  /**
   * Print Box Label on TSC Printer
   */
  async printBoxLabel(data: BoxLabelData): Promise<void> {
    const zpl = this.generateBoxLabelZPL(data);
    await this.sendToPrinter(this.TSC_IP, this.TSC_PORT, zpl);
    console.log(`✅ Box label printed: ${data.barcode}`);
  }

  /**
   * Print Box Manifest on HP Laser Printer
   */
  async printManifest(data: ManifestData): Promise<void> {
    const html = this.generateManifestHTML(data);
    const pdf = this.htmlToPdf(html);
    await this.sendToPrinter(this.HP_IP, this.HP_PORT, pdf);
    console.log(`✅ Manifest printed for box: ${data.boxNumber}`);
  }

  /**
   * Generate ZPL for Bag Label
   */
  private generateBagLabelZPL(data: BagLabelData): string {
    // Width is used, height is not needed for ZPL generation
    // The printer handles paper feed automatically
    return `
    ^XA
    ^CF0,30
    ^FO20,20^BY3^BCN,100,Y,N,N^FD>;${data.barcode}^FS
    ^FO20,140^A0N,30,30^FDPatient: ${data.patientName} ${data.patientSurname}^FS
    ^FO20,190^A0N,25,25^FDCollection Date: ${data.collectionDate}^FS
    ^FO20,240^A0N,25,25^FDPickup Point: ${data.pickupPoint}^FS
    ^FO20,290^A0N,20,20^FDScan to track medication^FS
    ^XZ
  `;
  }

  /**
   * Generate ZPL for Box Label
   */
  private generateBoxLabelZPL(data: BoxLabelData): string {
    return `
      ^XA
      ^CF0,40
      ^FO20,20^BY5^BCN,120,Y,N,N^FD>;${data.barcode}^FS
      ^FO20,160^A0N,30,30^FDCollection Date: ${data.collectionDate}^FS
      ^FO20,210^A0N,30,30^FDPickup Point: ${data.pickupPoint}^FS
      ^FO20,260^A0N,20,20^FDCONTENTS: Medication Parcels^FS
      ^FO20,300^A0N,20,20^FDHandle with care^FS
      ^XZ
    `;
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
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.connect(port, ip, () => {
        client.write(data);
        client.end();
        resolve();
      });

      client.on('error', (err) => {
        console.error(`Printer error at ${ip}:`, err);
        reject(err);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Printer timeout at ${ip}`));
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
