/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

// Define proper interfaces
interface DrugPickupPointEntity {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
}

interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  primaryContact: string;
  regimen: string;
  location: string;
  drugPickupPoint: string;
  drugPickupPointEntity?: DrugPickupPointEntity;
  prescriptionDate: string;
  nextDrugPickupDate: string;
  drugPickupPointId?: string;
  createdAt?: string;
  status?: string;
}

export function UnprocessedTable({ record, onRefresh }: { record: PatientRecord, onRefresh: () => void }) {
  const [editData, setEditData] = useState<PatientRecord>({ ...record });
  const [isOpen, setIsOpen] = useState(false);

  // Get display name for pickup point (from entity or fallback to string field)
  const pickupPointDisplayName = record.drugPickupPointEntity?.name || record.drugPickupPoint || 'Not specified';

  const handleUpdate = async () => {
    const loadingToast = toast.loading("Updating record...");
    
    try {
      const res = await fetch(`http://localhost:3000/imports/update/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editData.firstName,
          lastName: editData.lastName,
          primaryContact: editData.primaryContact,
          regimen: editData.regimen,
          location: editData.location,
          drugPickupPoint: editData.drugPickupPoint,
          nextDrugPickupDate: editData.nextDrugPickupDate,
        })
      });

      toast.dismiss(loadingToast);

      if (res.ok) {
        toast.success("Update Successful", {
          description: "Record has been updated."
        });
        setIsOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        toast.error("Update Failed", {
          description: err.message || "Could not update record."
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Error", {
        description: "Network error occurred."
      });
    }
  };

  return (
    <TableRow className="hover:bg-slate-50 transition-colors">
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span>{record.firstName} {record.lastName}</span>
          <span className="text-[10px] text-slate-400 font-mono">{record.id?.split('-')[0]}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{record.primaryContact}</TableCell>
      <TableCell className="max-w-[150px] truncate text-xs">{record.regimen}</TableCell>
      <TableCell>{record.location}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{pickupPointDisplayName}</span>
          {record.drugPickupPointEntity?.address && (
            <span className="text-[10px] text-slate-400">{record.drugPickupPointEntity.address}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-blue-600 font-bold">{record.nextDrugPickupDate}</span>
          <span className="text-[10px] text-slate-400 italic">Rx: {record.prescriptionDate}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:text-blue-600">
              <Pencil className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Manual Correction: {record.firstName}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input 
                    value={editData.firstName} 
                    onChange={e => setEditData({...editData, firstName: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    value={editData.lastName} 
                    onChange={e => setEditData({...editData, lastName: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Primary Contact (Must start with +266)</Label>
                <Input 
                  value={editData.primaryContact} 
                  onChange={e => setEditData({...editData, primaryContact: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Regimen Prescribed</Label>
                <Input 
                  value={editData.regimen} 
                  onChange={e => setEditData({...editData, regimen: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input 
                    value={editData.location} 
                    onChange={e => setEditData({...editData, location: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Drug Pickup Point</Label>
                  <Input 
                    value={editData.drugPickupPoint || ''} 
                    onChange={e => setEditData({...editData, drugPickupPoint: e.target.value})} 
                    placeholder="e.g., Maseru Mall Collect&Go"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Next Pickup Date</Label>
                <Input 
                  type="date" 
                  value={editData.nextDrugPickupDate ? new Date(editData.nextDrugPickupDate).toISOString().split('T')[0] : ''} 
                  onChange={e => setEditData({...editData, nextDrugPickupDate: e.target.value})} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate} className="bg-blue-600">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}