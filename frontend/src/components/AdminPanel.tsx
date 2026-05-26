import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PickupPointsManager } from './admin/PickupPointsManager';
import { LocationsManager } from './admin/LocationsManager';
import { RegimensManager } from './admin/RegimensManager';
import { ReportsPlaceholder } from './admin/ReportsPlaceholder';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('pickup-points');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Admin Dashboard</h2>
        <p className="text-slate-500">Manage drug pickup points, locations, regimens, and view reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pickup-points">Drug Pickup Points</TabsTrigger>
          <TabsTrigger value="locations">Locations (Clinics)</TabsTrigger>
          <TabsTrigger value="regimens">Regimens (Drugs)</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="pickup-points">
          <PickupPointsManager />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsManager />
        </TabsContent>

        <TabsContent value="regimens">
          <RegimensManager />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  );
}