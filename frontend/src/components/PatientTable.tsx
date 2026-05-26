/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Search } from "lucide-react";
import { UnprocessedTable } from "./UnprocessedTable";

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
  createdAt: string;
  status: string;
}

export function PatientTable() {
  const [data, setData] = useState<PatientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof PatientRecord | 'pickupPoint', direction: 'asc' | 'desc' } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/imports/pending");
      const json = await res.json();
      console.log('Fetched patients:', json);
      setData(json);
    } catch (error) {
      console.error("Failed to fetch pending records:", error);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return data.filter((item) => 
      `${item.firstName} ${item.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.primaryContact?.includes(searchTerm) ||
      item.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.drugPickupPointEntity?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.drugPickupPoint?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    const sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string;
        let bValue: string;
        
        // Handle special case for pickup point
        if (sortConfig.key === 'pickupPoint') {
          aValue = a.drugPickupPointEntity?.name || a.drugPickupPoint || '';
          bValue = b.drugPickupPointEntity?.name || b.drugPickupPoint || '';
        } else {
          aValue = String(a[sortConfig.key as keyof PatientRecord] || '');
          bValue = String(b[sortConfig.key as keyof PatientRecord] || '');
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key: keyof PatientRecord | 'pickupPoint') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name, phone, location, or pickup point..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <p className="text-sm text-slate-500">{filteredData.length} records found</p>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => requestSort('lastName')}>
                Patient Name <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Regimen</TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort('location')}>
                Location <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort('pickupPoint')}>
                Drug Pickup Point <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort('nextDrugPickupDate')}>
                Next Pickup <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((record) => (
              <UnprocessedTable 
                key={record.id} 
                record={record} 
                onRefresh={fetchData} 
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}