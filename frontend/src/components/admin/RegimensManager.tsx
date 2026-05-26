/* eslint-disable @typescript-eslint/no-explicit-any */
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

interface Regimen {
  id: string;
  alias: string;
  fullName: string;
  description: string;
  isActive: boolean;
}

export function RegimensManager() {
  const [regimens, setRegimens] = useState<Regimen[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRegimen, setEditingRegimen] = useState<Regimen | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchRegimens = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/admin/regimens');
      const data = await res.json();
      setRegimens(data);
    } catch (error) {
      toast.error('Failed to load regimens');
    } finally {
      setLoading(false);
    }
  };

  const saveRegimen = async (regimen: Partial<Regimen>) => {
    try {
      const url = regimen.id 
        ? `http://localhost:3000/admin/regimens/${regimen.id}`
        : 'http://localhost:3000/admin/regimens';
      
      const method = regimen.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regimen),
      });

      if (res.ok) {
        toast.success(regimen.id ? 'Regimen updated' : 'Regimen created');
        setIsDialogOpen(false);
        setEditingRegimen(null);
        await fetchRegimens();
      } else {
        toast.error('Failed to save regimen');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const deleteRegimen = async (id: string) => {
    if (!confirm('Are you sure you want to delete this regimen?')) return;
    
    try {
      const res = await fetch(`http://localhost:3000/admin/regimens/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Regimen deleted');
        await fetchRegimens();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  useEffect(() => {
    fetchRegimens();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Regimens (Drugs)</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingRegimen(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Regimen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRegimen ? 'Edit Regimen' : 'Add New Regimen'}</DialogTitle>
            </DialogHeader>
            <RegimenForm 
              initialData={editingRegimen} 
              onSave={saveRegimen}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingRegimen(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alias</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regimens.map((regimen) => (
              <TableRow key={regimen.id}>
                <TableCell className="font-mono font-medium">{regimen.alias}</TableCell>
                <TableCell>{regimen.fullName}</TableCell>
                <TableCell>{regimen.description || '-'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${regimen.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {regimen.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingRegimen(regimen);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteRegimen(regimen.id)}>
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

function RegimenForm({ initialData, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    alias: initialData?.alias || '',
    fullName: initialData?.fullName || '',
    description: initialData?.description || '',
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.alias || !formData.fullName) {
      toast.error('Alias and Full Name are required');
      return;
    }
    onSave({ ...formData, id: initialData?.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Alias *</Label>
        <Input
          required
          value={formData.alias}
          onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
          placeholder="e.g., 1j"
        />
        <p className="text-xs text-slate-500">Short code or abbreviation</p>
      </div>
      <div className="space-y-2">
        <Label>Full Name *</Label>
        <Input
          required
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          placeholder="e.g., TDF-3TC-DTG"
        />
        <p className="text-xs text-slate-500">Complete regimen name</p>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
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