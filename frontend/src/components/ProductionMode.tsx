import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, RefreshCw, ChevronLeft, CheckCircle2, History } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  targetDate: string;
  status: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientUniqueId: string;
  regimen: string;
  collectionLocation: string;
  status: string;
}

export function ProductionMode() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [allBatchRecords, setAllBatchRecords] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<Patient[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchBatches = useCallback(async () => {
    const res = await fetch("http://localhost:3000/imports/batches");
    const data = await res.json();
    setBatches(data);
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const loadBatchRecords = async (batch: Batch) => {
    const res = await fetch(`http://localhost:3000/imports/batch-records/${batch.id}`);
    const data: Patient[] = await res.json();
    
    setAllBatchRecords(data);
    // Queue only contains items not yet printed
    const pending = data.filter((r) => r.status !== 'PRINTED');
    setQueue(pending);
    setSelectedBatch(batch);
    setCurrentIndex(0);
  };

  const handleProcess = async () => {
    const current = queue[currentIndex];
    // Show loading toast
    const loadingToast = toast.loading(`Printing label for ${current.firstName}...`);

    try {
        const res = await fetch(`http://localhost:3000/imports/process-record/${current.id}`, {
        method: "POST"
        });

        toast.dismiss(loadingToast);

        if (res.ok) {
        toast.success("Success", {
            description: `Printed: ${current.firstName}`
        });
        
        // Update local state for history view
        setAllBatchRecords(prev => prev.map(r => r.id === current.id ? { ...r, status: 'PRINTED' } : r));

        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // End of the queue
            const complete = window.confirm("All records in this queue processed. Mark batch as completed?");
            if (complete) {
            await fetch(`http://localhost:3000/imports/complete-batch/${selectedBatch?.id}`, { method: 'POST' });
            toast.success("Batch Completed", {
                description: "All records have been processed successfully."
            });
            setSelectedBatch(null);
            fetchBatches();
            }
        }
        } else {
        toast.error("Print Failed", {
            description: `Could not print label for ${current.firstName}`
        });
        }

    } catch (error) {
        toast.dismiss(loadingToast);
        toast.error("Error", {
            description: "An unexpected error occurred"
        });
    }
    
  };

  const handleReprint = async (recordId: string) => {
    const res = await fetch(`http://localhost:3000/imports/reprint/${recordId}`, { method: 'POST' });
    if (res.ok) {
      toast.info("Reprinting...", {
        description: "Hardware simulation triggered."
      });
    } else {
      toast.error("Reprint Failed", {
        description: "Could not reprint the label."
      });
    }
  };

  // View: Batch Selection
  if (!selectedBatch) {
    const renderBatchList = (statusType: 'CREATED' | 'COMPLETED') => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {batches.filter(b => b.status === statusType).map(batch => (
          <Card 
            key={batch.id} 
            className="cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            onClick={() => loadBatchRecords(batch)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">{batch.name}</CardTitle>
                <p className="text-sm text-slate-500">{batch.targetDate}</p>
              </div>
              {batch.status === 'COMPLETED' && <CheckCircle2 className="text-green-500 w-5 h-5" />}
            </CardHeader>
          </Card>
        ))}
      </div>
    );

    return (
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="active">Active Work</TabsTrigger>
          <TabsTrigger value="archive">Completed Archive</TabsTrigger>
        </TabsList>
        <TabsContent value="active">{renderBatchList('CREATED')}</TabsContent>
        <TabsContent value="archive">{renderBatchList('COMPLETED')}</TabsContent>
      </Tabs>
    );
  }

  // View: Production Line
  const activePatient = queue[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <Button variant="ghost" onClick={() => setSelectedBatch(null)}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Batches
        </Button>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase">Current Batch</p>
          <p className="font-semibold text-blue-600">{selectedBatch.name}</p>
        </div>
      </div>

      {activePatient ? (
        <Card className="border-t-8 border-t-blue-600 shadow-2xl">
          <CardHeader className="text-center">
            <Badge variant="outline" className="mx-auto mb-2 text-blue-700 border-blue-200 bg-blue-50">
              {activePatient.collectionLocation}
            </Badge>
            <CardTitle className="text-5xl font-black tracking-tight">
              {activePatient.firstName} {activePatient.lastName}
            </CardTitle>
            <p className="text-lg text-slate-500 mt-2 font-mono">{activePatient.patientUniqueId}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border-2 border-dashed border-slate-200">
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Prescription / Regimen</h4>
              <p className="text-2xl font-bold text-slate-800">{activePatient.regimen}</p>
            </div>

            <Button 
              className="w-full h-28 text-3xl gap-4 bg-green-600 hover:bg-green-700 transition-all"
              onClick={handleProcess}
            >
              <Printer className="w-10 h-10" />
              CONFIRM & PRINT
            </Button>
            <p className="text-center text-sm text-slate-400">
              Item {currentIndex + 1} of {queue.length} pending in this location
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-50 border-green-200 p-10 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-800">Queue Clear!</h2>
          <p className="text-green-700">All patients in this batch have been processed.</p>
        </Card>
      )}

      {/* REPRINT / HISTORY SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500">
          <History className="w-5 h-5" />
          <h3 className="font-bold">Batch History & Reprints</h3>
        </div>
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {allBatchRecords.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-bold text-slate-700">{rec.firstName} {rec.lastName}</p>
                  <div className="flex gap-2 items-center">
                    <p className="text-xs text-slate-500 font-mono">{rec.patientUniqueId}</p>
                    {rec.status === 'PRINTED' && <Badge className="text-[10px] h-4 bg-green-100 text-green-700 hover:bg-green-100">Printed</Badge>}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs gap-2"
                  onClick={() => handleReprint(rec.id)}
                >
                  <RefreshCw className="w-3 h-3" /> Reprint
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}