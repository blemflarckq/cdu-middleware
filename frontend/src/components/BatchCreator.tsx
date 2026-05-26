import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function BatchCreator({ onBatchCreated }: { onBatchCreated: () => void }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const handleCreateBatch = async () => {
    if (!date) {
      toast.error("Error", {
        description: "Please select a collection date."
      });
      return;
    }

    const res = await fetch("http://localhost:3000/imports/create-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDate: date, batchName: name }),
    });

    if (res.ok) {
      toast.success("Batch Created", {
        description: name 
          ? `Batch "${name}" created for ${date}` 
          : `Batch created for ${date}`
      });
      setDate("");
      setName("");
      onBatchCreated();
    } else {
      const error = await res.json();
      toast.error("Error", {
        description: error.message || "No eligible records found for this date."
      });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end">
      <div className="flex-1 space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Collection Date <span className="text-red-500">*</span>
        </label>
        <Input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          className="w-full"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Batch Name (Optional)
        </label>
        <Input 
          placeholder="e.g., Maseru Morning Run" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="w-full"
        />
      </div>
      <Button 
        onClick={handleCreateBatch} 
        disabled={!date}
        className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
      >
        Create Batch
      </Button>
    </div>
  );
}