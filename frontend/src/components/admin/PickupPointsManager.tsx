/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PickupPoint {
  id: string;
  name: string;
  externalId: string;
  address: string;
  contactNumber: string;
  isActive: boolean;
}

export function PickupPointsManager() {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PickupPoint | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchPoints = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/admin/pickup-points');
      const data = await res.json();
      setPoints(data);
    } catch (error) {
      toast.error('Failed to load pickup points');
    } finally {
      setLoading(false);
    }
  };

  const syncFromExternal = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/admin/pickup-points/sync', { method: 'POST' });
      if (res.ok) {
        toast.success('Pickup points synced successfully');
        await fetchPoints();
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      toast.error('Failed to sync with external API');
    } finally {
      setLoading(false);
    }
  };

  const savePoint = async (point: Partial<PickupPoint>) => {
    try {
      const url = point.id 
        ? `http://localhost:3000/admin/pickup-points/${point.id}`
        : 'http://localhost:3000/admin/pickup-points';
      
      const method = point.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point),
      });

      if (res.ok) {
        toast.success(point.id ? 'Pickup point updated' : 'Pickup point created');
        setIsDialogOpen(false);
        setEditingPoint(null);
        await fetchPoints();
      } else {
        toast.error('Failed to save pickup point');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const deletePoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pickup point?')) return;
    
    try {
      const res = await fetch(`http://localhost:3000/admin/pickup-points/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Pickup point deleted');
        await fetchPoints();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPoints();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Drug Pickup Points</CardTitle>
        <div className="space-x-2">
          <Button onClick={syncFromExternal} variant="outline" disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync from External API
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingPoint(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Pickup Point
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPoint ? 'Edit Pickup Point' : 'Add New Pickup Point'}</DialogTitle>
              </DialogHeader>
              <PickupPointForm 
                initialData={editingPoint} 
                onSave={savePoint}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingPoint(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.id}>
                <TableCell className="font-medium">{point.name}</TableCell>
                <TableCell className="text-xs font-mono">{point.externalId || '-'}</TableCell>
                <TableCell>{point.address || '-'}</TableCell>
                <TableCell>{point.contactNumber || '-'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${point.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {point.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingPoint(point);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deletePoint(point.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Form component for pickup points
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PickupPointForm({ initialData, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    address: initialData?.address || '',
    contactNumber: initialData?.contactNumber || '',
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: initialData?.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Maseru Mall Pickup"
        />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Physical address"
        />
      </div>
      <div className="space-y-2">
        <Label>Contact Number</Label>
        <Input
          value={formData.contactNumber}
          onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
          placeholder="Phone number"
        />
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="rounded border-gray-300"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}