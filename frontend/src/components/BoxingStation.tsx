/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScanBarcode, Package, Send, AlertCircle, RefreshCw, FileText } from 'lucide-react';
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
  logisticsStatus?: string;
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

  const fetchBoxes = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const res = await fetch('http://localhost:3000/imports/boxes');
      if (res.ok) {
        const data = await res.json();
        if (isMounted.current) {
          setBoxes(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch boxes:', error);
    }
  }, []);

  const fetchCurrentOpenBox = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const res = await fetch('http://localhost:3000/imports/boxes/open/current');
      if (res.ok) {
        const data = await res.json();
        if (isMounted.current && data && data.id) {
          setCurrentBox(data);
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

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBoxes(), fetchCurrentOpenBox()]);
    setRefreshing(false);
  }, [fetchBoxes, fetchCurrentOpenBox]);

  useEffect(() => {
    isMounted.current = true;
    refreshData();
    return () => {
      isMounted.current = false;
    };
  }, [refreshData]);

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

  const handleRetrySend = async (boxId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/imports/retry-send-box/${boxId}`, {
        method: 'POST',
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success('Retry Initiated', {
          description: `Box ${result.boxNumber} is being resent to logistics.`,
        });
        await refreshData();
      } else {
        toast.error('Retry Failed', {
          description: result.message || 'Could not resend box to logistics',
        });
      }
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NEW: Print Manifest handler
  const handlePrintManifest = async (boxId: string, boxNumber: string) => {
    setLoading(true);
    const loadingToast = toast.loading(`Printing manifest for ${boxNumber}...`);

    try {
      const res = await fetch(`http://localhost:3000/imports/print-manifest/${boxId}`, {
        method: 'POST',
      });

      const result = await res.json();
      toast.dismiss(loadingToast);

      if (res.ok && result.success) {
        toast.success('Manifest Printed', {
          description: result.message || `Manifest sent to printer for ${boxNumber}`,
        });
      } else {
        toast.error('Print Failed', {
          description: result.message || 'Could not print manifest',
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Print manifest error:', error);
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

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
      <Card className={currentBox ? 'border-blue-200 bg-blue-50/30' : 'border-dashed border-2 bg-slate-50'}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              {currentBox ? `Active Box: ${currentBox.boxNumber}` : 'No Active Box'}
            </CardTitle>
            {currentBox && (
              <p className="text-sm text-slate-600 mt-1">
                Destination: {currentBox.destinationLocation} | Collection Date:{' '}
                {currentBox.collectionDate} | Bags: {currentBox.bags?.length || 0}
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

            {!currentBox && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-blue-700">
                  Scan a bag to automatically create a box for its pickup point
                </p>
              </div>
            )}

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
                        <TableCell className="text-xs">
                          {bag.patientRecord?.regimen || '-'}
                        </TableCell>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                      No boxes created yet. Scan a bag to start boxing.
                    </TableCell>
                  </TableRow>
                ) : (
                  boxes.map((box) => (
                    <TableRow key={box.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {box.boxNumber}
                      </TableCell>
                      <TableCell>{box.destinationLocation}</TableCell>
                      <TableCell>{box.collectionDate || '-'}</TableCell>
                      <TableCell>{box.bags?.length || 0}</TableCell>
                      <TableCell>{getStatusBadge(box.status)}</TableCell>
                      <TableCell>{getLogisticsStatusBadge(box.logisticsStatus)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(box.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {/* 🔥 NEW: Print Manifest button */}
                          {(box.status === 'CLOSED' || box.status === 'SENT') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintManifest(box.id, box.boxNumber)}
                              className="text-purple-600 border-purple-300 hover:bg-purple-50"
                              disabled={loading}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Manifest
                            </Button>
                          )}
                          {/* Retry button for failed logistics */}
                          {box.logisticsStatus === 'FAILED' && (
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
                        </div>
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
              <span className="text-slate-600">FAILED - Click Retry</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}