/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Package, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface PrintStationProps {
  bagData?: {
    barcode: string;
    patientName: string;
    patientSurname: string;
    collectionDate: string;
    pickupPoint: string;
  };
  boxData?: {
    barcode: string;
    collectionDate: string;
    pickupPoint: string;
  };
  manifestData?: {
    boxNumber: string;
    destinationLocation: string;
    items: any[];
    collectionDate: string;
  };
}

export function PrintStation({ bagData, boxData, manifestData }: PrintStationProps) {
  const [printing, setPrinting] = useState<{ type: string; status: boolean }>({
    type: '',
    status: false
  });

  const printBagLabel = async () => {
    if (!bagData) return;
    
    setPrinting({ type: 'bag', status: true });
    try {
      const response = await fetch('http://localhost:3000/print/bag-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bagData)
      });
      
      if (response.ok) {
        toast.success('Bag Label Printed', {
          description: `Label for ${bagData.patientName} ${bagData.patientSurname} sent to TSC printer`
        });
      } else {
        throw new Error('Print failed');
      }
    } catch (error) {
      toast.error('Print Failed', {
        description: 'Could not communicate with TSC printer'
      });
    } finally {
      setPrinting({ type: '', status: false });
    }
  };

  const printBoxLabel = async () => {
    if (!boxData) return;
    
    setPrinting({ type: 'box', status: true });
    try {
      const response = await fetch('http://localhost:3000/print/box-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boxData)
      });
      
      if (response.ok) {
        toast.success('Box Label Printed', {
          description: `Box label ${boxData.barcode} sent to TSC printer`
        });
      } else {
        throw new Error('Print failed');
      }
    } catch (error) {
      toast.error('Print Failed', {
        description: 'Could not communicate with TSC printer'
      });
    } finally {
      setPrinting({ type: '', status: false });
    }
  };

  const printManifest = async () => {
    if (!manifestData) return;
    
    setPrinting({ type: 'manifest', status: true });
    try {
      const response = await fetch('http://localhost:3000/print/manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifestData)
      });
      
      if (response.ok) {
        toast.success('Manifest Printed', {
          description: `Manifest for box ${manifestData.boxNumber} sent to HP LaserJet`
        });
      } else {
        throw new Error('Print failed');
      }
    } catch (error) {
      toast.error('Print Failed', {
        description: 'Could not communicate with HP printer'
      });
    } finally {
      setPrinting({ type: '', status: false });
    }
  };

  return (
    <div className="space-y-4">
      {/* Bag Label Printing */}
      {bagData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print Bag Label (TSC MB240)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Patient:</strong> {bagData.patientName} {bagData.patientSurname}</p>
              <p><strong>Collection Date:</strong> {bagData.collectionDate}</p>
              <p><strong>Pickup Point:</strong> {bagData.pickupPoint}</p>
              <Button 
                onClick={printBagLabel}
                disabled={printing.status}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {printing.type === 'bag' ? 'Printing...' : 'Print Bag Label'}
                <Printer className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Label Printing */}
      {boxData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Print Box Label (TSC MB240)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Box Barcode:</strong> {boxData.barcode}</p>
              <p><strong>Collection Date:</strong> {boxData.collectionDate}</p>
              <p><strong>Pickup Point:</strong> {boxData.pickupPoint}</p>
              <Button 
                onClick={printBoxLabel}
                disabled={printing.status}
                variant="outline"
                className="w-full"
              >
                {printing.type === 'box' ? 'Printing...' : 'Print Box Label'}
                <Package className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manifest Printing */}
      {manifestData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Print Box Manifest (HP LaserJet A4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Box Number:</strong> {manifestData.boxNumber}</p>
              <p><strong>Destination:</strong> {manifestData.destinationLocation}</p>
              <p><strong>Items:</strong> {manifestData.items.length} parcels</p>
              <Button 
                onClick={printManifest}
                disabled={printing.status}
                variant="secondary"
                className="w-full"
              >
                {printing.type === 'manifest' ? 'Printing...' : 'Print Manifest'}
                <FileText className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}