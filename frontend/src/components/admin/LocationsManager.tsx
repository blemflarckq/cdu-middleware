/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  id: string;
  name: string;
  district: string;
  council: string;
  ward: string;
  isActive: boolean;
}

export function LocationsManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/admin/locations');
      const data = await res.json();
      setLocations(data);
    } catch (error) {
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async (location: Partial<Location>) => {
    try {
      const url = location.id 
        ? `http://localhost:3000/admin/locations/${location.id}`
        : 'http://localhost:3000/admin/locations';
      
      const method = location.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
      });

      if (res.ok) {
        toast.success(location.id ? 'Location updated' : 'Location created');
        setIsDialogOpen(false);
        setEditingLocation(null);
        await fetchLocations();
      } else {
        toast.error('Failed to save location');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;
    
    try {
      const res = await fetch(`http://localhost:3000/admin/locations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Location deleted');
        await fetchLocations();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Locations (Clinics)</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingLocation(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
            </DialogHeader>
            <LocationForm 
              initialData={editingLocation} 
              onSave={saveLocation}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingLocation(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Council</TableHead>
              <TableHead>Ward</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>{location.district || '-'}</TableCell>
                <TableCell>{location.council || '-'}</TableCell>
                <TableCell>{location.ward || '-'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${location.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {location.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingLocation(location);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteLocation(location.id)}>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LocationForm({ initialData, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    district: initialData?.district || '',
    council: initialData?.council || '',
    ward: initialData?.ward || '',
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
          placeholder="e.g., Domicilliary HC"
        />
      </div>
      <div className="space-y-2">
        <Label>District</Label>
        <Input
          value={formData.district}
          onChange={(e) => setFormData({ ...formData, district: e.target.value })}
          placeholder="e.g., Maseru"
        />
      </div>
      <div className="space-y-2">
        <Label>Council</Label>
        <Input
          value={formData.council}
          onChange={(e) => setFormData({ ...formData, council: e.target.value })}
          placeholder="e.g., Maseru Urban"
        />
      </div>
      <div className="space-y-2">
        <Label>Ward</Label>
        <Input
          value={formData.ward}
          onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
          placeholder="e.g., Ward 10"
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