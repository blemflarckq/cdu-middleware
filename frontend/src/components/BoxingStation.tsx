/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScanBarcode, Package, Send, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Bag {
  id: string;
  barcode: string;
  patientName: string;
  collectionLocation: string;
  status: string;
  patientRecord?: {
    firstName: string;
    lastName: string;
    regimen: string;
  };
}

interface Box {
  id: string;
  boxNumber: string;
  destinationLocation: string;
  collectionDate: string;
  status: 'OPEN' | 'CLOSED' | 'SENT';
  logisticsStatus?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRYING' | 'PENDING_CONFIRMATION';
  bags: Bag[];
  createdAt: string;
  updatedAt: string;
}

export function BoxingStation() {
  const [scanInput, setScanInput] = useState('');
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isMounted = useRef(true);

  // Fetch all boxes
  const fetchBoxes = useCallback(async () => {
    if (!isMounted.current) return;

    console.log("🔵 fetchBoxes: Starting...");
    
    try {
      const res = await fetch('http://localhost:3000/imports/boxes');
      if (res.ok) {
        const data = await res.json();
        console.log("🔵 Boxes data:", data);
        console.log("🔵 First box logisticsStatus:", data[0]?.logisticsStatus);
        if (isMounted.current) {
          setBoxes(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch boxes:', error);
    }
  }, []);

  // Fetch current open box
  const fetchCurrentOpenBox = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const res = await fetch('http://localhost:3000/imports/boxes/open/current');
      if (res.ok) {
        const data = await res.json();
        if (isMounted.current && data && data.id) {
          setCurrentBox(data);
          console.log('Current open box loaded:', data);
        } else if (isMounted.current) {
          setCurrentBox(null);
        }
      } else {
        if (isMounted.current) {
          setCurrentBox(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch open box:', error);
      if (isMounted.current) {
        setCurrentBox(null);
      }
    }
  }, []);
  
  // Refresh all data
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBoxes(), fetchCurrentOpenBox()]);
    setRefreshing(false);
  }, [fetchBoxes, fetchCurrentOpenBox]);

  // Initial load
  useEffect(() => {
    isMounted.current = true;
    console.log('isMounted from useEffect at render is:', isMounted.current);
    refreshData();
    return () => { isMounted.current = false; };
  }, [refreshData]);

  // Scan bag barcode
  const handleScanBag = async () => {
    if (!scanInput.trim()) {
      toast.error('Error', { description: 'Please scan a bag barcode' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/imports/scan-to-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bagBarcode: scanInput }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(result.isNewBox ? 'New Box Created' : 'Bag Scanned', {
          description: result.isNewBox 
            ? `New box ${result.boxNumber} created for ${result.location}`
            : `${result.patient} added to box ${result.boxNumber}`,
        });
        
        await refreshData();
        setScanInput('');
      } else {
        toast.error('Scan Failed', { description: result.message || 'Could not scan bag' });
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  // Close current box
  const handleCloseBox = async () => {
    if (!currentBox) return;

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/imports/close-box/${currentBox.id}`, {
        method: 'POST',
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success('Box Closed', {
          description: result.message || `Box ${currentBox.boxNumber} closed successfully`,
        });
        
        await refreshData();
      } else {
        toast.error('Failed to Close Box', {
          description: result.message || 'Could not close the box',
        });
      }
    } catch (error) {
      console.error('Close box error:', error);
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  // Retry sending failed box
  const handleRetrySend = async (boxId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/imports/retry-send-box/${boxId}`, {
        method: 'POST',
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        toast.success('Retry Initiated', {
          description: `Box ${result.boxNumber} is being resent to logistics.`
        });
        await refreshData();
      } else {
        toast.error('Retry Failed', {
          description: result.message || 'Could not resend box to logistics'
        });
      }
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleReprintBoxLabel = async (boxId: string, boxNumber: string) => {
  setLoading(true);
  try {
    const res = await fetch(`http://localhost:3000/print/reprint-box-label/${boxId}`, {
      method: 'POST',
    });
    
    const result = await res.json();
    
    if (res.ok && result.success) {
      toast.success('Box Label Reprint', {
        description: `Box label for ${result.boxNumber} has been sent to printer.`
      });
    } else {
      toast.error('Reprint Failed', {
        description: result.message || 'Could not reprint box label'
      });
    }
  } catch (error) {
    console.error('Reprint error:', error);
    toast.error('Error', { description: 'Network error occurred' });
  } finally {
    setLoading(false);
  }
};

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-green-100 text-green-700">OPEN</Badge>;
      case 'CLOSED':
        return <Badge className="bg-yellow-100 text-yellow-700">CLOSED</Badge>;
      case 'SENT':
        return <Badge className="bg-blue-100 text-blue-700">SENT</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get logistics status badge
  const getLogisticsStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-700">FAILED</Badge>;
      case 'SENT':
        return <Badge className="bg-green-100 text-green-700">SENT</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-100 text-blue-700">PROCESSING</Badge>;
      case 'PENDING_CONFIRMATION':
        return <Badge className="bg-yellow-100 text-yellow-700">PENDING</Badge>;
      case 'RETRYING':
        return <Badge className="bg-orange-100 text-orange-700">RETRYING</Badge>;
      default:
        return <Badge variant="outline">PENDING</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={refreshData} disabled={refreshing} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Current Active Box Section */}
      <Card className={currentBox ? "border-blue-200 bg-blue-50/30" : "border-dashed border-2 bg-slate-50"}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              {currentBox ? `Active Box: ${currentBox.boxNumber}` : 'No Active Box'}
            </CardTitle>
            {currentBox && (
              <p className="text-sm text-slate-600 mt-1">
                Destination: {currentBox.destinationLocation} | 
                Collection Date: {currentBox.collectionDate} | 
                Bags: {currentBox.bags?.length || 0}
              </p>
            )}
          </div>
          {currentBox && currentBox.bags?.length > 0 && (
            <Button onClick={handleCloseBox} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4 mr-2" />
              Close Box
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Scan Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Scan or enter bag barcode"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanBag()}
                className="flex-1 font-mono"
                autoFocus
              />
              <Button onClick={handleScanBag} disabled={loading}>
                <ScanBarcode className="w-4 h-4 mr-2" />
                Add Bag
              </Button>
            </div>

            {/* Info message when no active box */}
            {!currentBox && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-blue-700">Scan a bag to automatically create a box for its pickup point</p>
              </div>
            )}

            {/* Bags in Current Box */}
            {currentBox && currentBox.bags && currentBox.bags.length > 0 && (
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Bag Barcode</TableHead>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>Regimen</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentBox.bags.map((bag) => (
                      <TableRow key={bag.id}>
                        <TableCell className="font-mono text-xs">{bag.barcode}</TableCell>
                        <TableCell className="font-medium">{bag.patientName}</TableCell>
                        <TableCell className="text-xs">{bag.patientRecord?.regimen || '-'}</TableCell>
                        <TableCell>{getStatusBadge(bag.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* All Boxes History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Box History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Box Number</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Collection Date</TableHead>
                  <TableHead>Bags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Logistics Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                      No boxes created yet. Scan a bag to start boxing.
                    </TableCell>
                  </TableRow>
                ) : (
                  boxes.map((box) => (
                    <TableRow key={box.id}>
                      <TableCell className="font-mono text-xs font-medium">{box.boxNumber}</TableCell>
                      <TableCell>{box.destinationLocation}</TableCell>
                      <TableCell>{box.collectionDate || '-'}</TableCell>
                      <TableCell>{box.bags?.length || 0}</TableCell>
                      <TableCell>{getStatusBadge(box.status)}</TableCell>
                      <TableCell>{getLogisticsStatusBadge(box.logisticsStatus)}</TableCell>
                      <TableCell className="text-sm">{new Date(box.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{new Date(box.updatedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {(box.logisticsStatus !== 'RETRYING') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRetrySend(box.id)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        {/* Reprint Box Label button - show for all closed/sent boxes */}
                        {(box.status === 'CLOSED' || box.status === 'SENT') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReprintBoxLabel(box.id, box.boxNumber)}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reprint Label
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Status Legend */}
      <Card className="bg-slate-50">
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-600">OPEN - Accepting bags</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-slate-600">CLOSED - Sealed, ready for logistics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-slate-600">SENT - Transferred to logistics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-600">FAILED - Send failed, click Retry</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}