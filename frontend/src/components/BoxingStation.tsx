/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScanBarcode, Package/*, CheckCircle, XCircle, Clock*/, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Bag {
  id: string;
  barcode: string;
  patientName: string;
  collectionLocation: string;
  status: string;
  patientRecord: {
    firstName: string;
    lastName: string;
    regimen: string;
  };
}

interface Box {
  id: string;
  boxNumber: string;
  destinationLocation: string;
  status: 'OPEN' | 'CLOSED' | 'SENT';
  logisticsReference?: string;
  bags: Bag[];
  createdAt: string;
  updatedAt: string;
}

export function BoxingStation() {
  const [scanInput, setScanInput] = useState('');
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all boxes
  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3000/imports/boxes');
      const data = await res.json();
      setBoxes(data);
    } catch (error) {
      console.error('Failed to fetch boxes:', error);
    }
  }, []);

  // Fetch box by ID
const fetchBoxById = useCallback(async (boxId: string) => {
  try {
    const res = await fetch(`http://localhost:3000/imports/boxes/${boxId}`);
    if (res.ok) {
      const box = await res.json();
      setCurrentBox(box);
      return box;
    } else if (res.status === 404) {
      toast.error('Box Not Found', { description: 'The box no longer exists' });
      setCurrentBox(null);
    }
  } catch (error) {
    console.error('Failed to fetch box:', error);
  }
  return null;
}, []);

  // Fetch current open box for a location (or create one)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchOrCreateOpenBox = useCallback(async (location: string) => {
    try {
      const res = await fetch(`http://localhost:3000/imports/boxes/open?location=${encodeURIComponent(location)}`);
      if (res.ok) {
        const box = await res.json();
        setCurrentBox(box);
        return box;
      }
    } catch (error) {
      console.error('Failed to fetch open box:', error);
    }
    return null;
  }, []);

  // Scan bag barcode
  const handleScanBag = async () => {
    if (!scanInput.trim()) {
      toast.error('Error', { description: 'Please scan a bag barcode' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/imports/scan-bag-to-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bagBarcode: scanInput }),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success('Bag Scanned', {
          description: `${result.patient} added to box ${result.boxNumber}`,
        });
        
        // Refresh the current box
        if (currentBox) {
          //const updatedBox = await fetch(`http://localhost:3000/boxes/${currentBox.id}`).then(r => r.json());
          //setCurrentBox(updatedBox);
          await fetchBoxById(currentBox.id);
        }
        
        setScanInput('');
        fetchBoxes(); // Refresh the boxes list
      } else {
        const error = await res.json();
        toast.error('Scan Failed', { description: error.message || 'Could not scan bag' });
      }
    } catch (error) {
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  // Close current box and send to logistics
  const handleCloseBox = async () => {
    if (!currentBox) return;

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/imports/close-box/${currentBox.id}`, {
        method: 'POST',
      });

      const result = await res.json();

      if (res.ok) {
        if (result.success) {
          toast.success('Box Closed', {
            description: result.message || `Box ${currentBox.boxNumber} closed and sent to logistics`,
          });
        } else {
          toast.warning('Box Closed with Issues', {
            description: result.message || `Box ${currentBox.boxNumber} closed but may need attention`,
          });
        }
        
        setCurrentBox(null);
        fetchBoxes();
      } else {
        toast.error('Failed to Close Box', {
          description: result.message || 'Could not close the box',
        });
      }
    } catch (error) {
      toast.error('Error', { description: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  // View box details
  const viewBox = (box: Box) => {
    setCurrentBox(box);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">OPEN</Badge>;
      case 'CLOSED':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">CLOSED</Badge>;
      case 'SENT':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">SENT</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  return (
    <div className="space-y-6">
      {/* Current Active Box Section */}
      {currentBox ? (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Active Box: {currentBox.boxNumber}
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Destination: {currentBox.destinationLocation} | Status: {currentBox.status}
              </p>
            </div>
            <Button 
              onClick={handleCloseBox} 
              disabled={loading || currentBox.bags.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Close & Send Box
            </Button>
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
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={handleScanBag} disabled={loading}>
                  <ScanBarcode className="w-4 h-4 mr-2" />
                  Add Bag
                </Button>
              </div>

              {/* Bags in Current Box */}
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Bag Barcode</TableHead>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>Regimen</TableHead>
                      <TableHead>Collection Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentBox.bags?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          No bags scanned yet. Scan a bag to add to this box.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentBox.bags?.map((bag) => (
                        <TableRow key={bag.id}>
                          <TableCell className="font-mono text-xs">{bag.barcode}</TableCell>
                          <TableCell className="font-medium">{bag.patientName}</TableCell>
                          <TableCell className="text-xs">{bag.patientRecord?.regimen || '-'}</TableCell>
                          <TableCell>{bag.collectionLocation}</TableCell>
                          <TableCell>{getStatusBadge(bag.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="text-sm text-slate-500">
                Total bags in box: <span className="font-bold">{currentBox.bags?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 bg-slate-50">
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">No Active Box</h3>
            <p className="text-sm text-slate-500 mb-4">
              Scan a bag to automatically create a new box for its collection location
            </p>
            <div className="flex gap-2 max-w-md mx-auto">
              <Input
                placeholder="Scan or enter bag barcode"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanBag()}
              />
              <Button onClick={handleScanBag} disabled={loading}>
                <ScanBarcode className="w-4 h-4 mr-2" />
                Start Box
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Boxes History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Box History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Box Number</TableHead>
                  <TableHead>Destination Location</TableHead>
                  <TableHead>Bags Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Closed/Sent At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      No boxes created yet. Scan a bag to start boxing.
                    </TableCell>
                  </TableRow>
                ) : (
                  boxes.map((box) => (
                    <TableRow key={box.id}>
                      <TableCell className="font-mono text-xs font-medium">{box.boxNumber}</TableCell>
                      <TableCell>{box.destinationLocation}</TableCell>
                      <TableCell>{box.bags?.length || 0}</TableCell>
                      <TableCell>{getStatusBadge(box.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(box.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {box.status !== 'OPEN' ? new Date(box.updatedAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewBox(box)}
                          disabled={box.status === 'OPEN' && currentBox?.id === box.id}
                        >
                          {box.status === 'OPEN' ? 'Active' : 'View Details'}
                        </Button>
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
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-600">OPEN - Accepting bags</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-slate-600">CLOSED - Sealed, pending logistics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-slate-600">SENT - Transferred to logistics</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}