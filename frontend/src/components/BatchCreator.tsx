import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function BatchCreator({ onBatchCreated }: { onBatchCreated: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [numberOfRepeats, setNumberOfRepeats] = useState(1);
  const [dosageInstructions, setDosageInstructions] = useState("");

  const handleCreateBatch = async () => {
    if (!startDate || !endDate) {
      toast.error("Error", { description: "Please select both start and end dates." });
      return;
    }

    // Validate date range (max 7 days)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      toast.error("Error", { description: "End date must be after start date." });
      return;
    }
    
    if (diffDays > 7) {
      toast.error("Error", { description: "Date range cannot exceed 7 days." });
      return;
    }

    const res = await fetch("http://localhost:3000/imports/create-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        startDate: startDate, 
        endDate: endDate,
        batchName: name,
        numberOfRepeats: numberOfRepeats,
        dosageInstructions: dosageInstructions
      }),
    });

    if (res.ok) {
      toast.success("Batch Created", {
        description: name 
          ? `Batch "${name}" created for ${startDate} to ${endDate} with ${numberOfRepeats} repeats`
          : `Batch created for ${startDate} to ${endDate} with ${numberOfRepeats} repeats`
      });
      setStartDate("");
      setEndDate("");
      setName("");
      setNumberOfRepeats(1);
      setDosageInstructions("");
      onBatchCreated();
    } else {
      const error = await res.json();
      toast.error("Error", {
        description: error.message || "No eligible records found for this date range."
      });
    }
  };

  return (
    <Card className="bg-slate-100 border-dashed border-2">
      <CardHeader>
        <CardTitle className="text-lg">Create New Batch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input 
              id="startDate"
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="endDate">End Date *</Label>
            <Input 
              id="endDate"
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              min={startDate}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Date range cannot exceed 7 days. Records with pickup dates within this range will be included.
        </p>
        
        <div className="grid gap-1.5">
          <Label htmlFor="batchName">Batch Name (Optional)</Label>
          <Input 
            id="batchName"
            placeholder="e.g. Maseru Morning Run" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="repeats">Number of Repeats (Bottles to Dispense) *</Label>
          <Input 
            id="repeats"
            type="number" 
            min="1"
            max="12"
            value={numberOfRepeats} 
            onChange={(e) => setNumberOfRepeats(parseInt(e.target.value) || 1)} 
          />
          <p className="text-xs text-slate-500">Number of bottles to dispense per prescription</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="dosage">Dosage Instructions</Label>
          <Textarea 
            id="dosage"
            placeholder="e.g. Take 1 tablet daily after meals. Swallow whole with water."
            value={dosageInstructions} 
            onChange={(e) => setDosageInstructions(e.target.value)} 
            rows={3}
          />
          <p className="text-xs text-slate-500">Instructions to print on each bottle label</p>
        </div>

        <Button 
          onClick={handleCreateBatch} 
          disabled={!startDate || !endDate}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Create Batch
        </Button>
      </CardContent>
    </Card>
  );
}