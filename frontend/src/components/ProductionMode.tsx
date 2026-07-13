import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, RefreshCw, ChevronLeft, CheckCircle2, History, Package, Eye } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
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
  const [activeBatches, setActiveBatches] = useState<Batch[]>([]);
  const [completedBatches, setCompletedBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [allBatchRecords, setAllBatchRecords] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<Patient[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [isArchivedView, setIsArchivedView] = useState(false);

  // Load batches on mount
  useEffect(() => {
    const loadBatches = async () => {
      try {
        console.log("Loading batches...");
        
        const [activeRes, completedRes] = await Promise.all([
          fetch("http://localhost:3000/imports/batches"),
          fetch("http://localhost:3000/imports/batches/completed")
        ]);
        
        const activeData = await activeRes.json();
        const completedData = await completedRes.json();
        
        console.log("Active batches:", activeData);
        console.log("Completed batches:", completedData);
        
        setActiveBatches(Array.isArray(activeData) ? activeData : []);
        setCompletedBatches(Array.isArray(completedData) ? completedData : []);
      } catch (error) {
        console.error("Failed to load batches:", error);
        toast.error("Error", { description: "Failed to load batches" });
      } finally {
        setLoading(false);
      }
    };
    
    loadBatches();
  }, []);

  const loadBatchRecords = async (batch: Batch, isArchived: boolean = false) => {
    setPrinting(true);
    setIsArchivedView(isArchived);
    try {
      const res = await fetch(`http://localhost:3000/imports/batch-records/${batch.id}`);
      const data: Patient[] = await res.json();
      
      setAllBatchRecords(data);
      // For archived batches, show all records (including PRINTED ones)
      // For active batches, only show pending ones in the queue
      if (isArchived) {
        setQueue(data); // Show all records for archived batches
      } else {
        const pending = data.filter((r) => r.status !== 'PRINTED');
        setQueue(pending);
      }
      setSelectedBatch(batch);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Failed to load batch records:", error);
      toast.error("Error", { description: "Failed to load batch records" });
    } finally {
      setPrinting(false);
    }
  };

  const handleProcess = async () => {
    if (!queue.length || !queue[currentIndex]) return;
    
    const current = queue[currentIndex];
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
        
        setAllBatchRecords(prev => prev.map(r => 
          r.id === current.id ? { ...r, status: 'PRINTED' } : r
        ));

        if (currentIndex < queue.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          const complete = window.confirm("All records in this queue processed. Mark batch as completed?");
          if (complete) {
            await fetch(`http://localhost:3000/imports/complete-batch/${selectedBatch?.id}`, { 
              method: 'POST' 
            });
            toast.success("Batch Completed", {
              description: "All records have been processed successfully."
            });
            setSelectedBatch(null);
            // Reload batches
            const [activeRes, completedRes] = await Promise.all([
              fetch("http://localhost:3000/imports/batches"),
              fetch("http://localhost:3000/imports/batches/completed")
            ]);
            const activeData = await activeRes.json();
            const completedData = await completedRes.json();
            setActiveBatches(Array.isArray(activeData) ? activeData : []);
            setCompletedBatches(Array.isArray(completedData) ? completedData : []);
          }
        }
      } else {
        toast.error("Print Failed", {
          description: `Could not print label for ${current.firstName}`
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Process error:", error);
      toast.error("Error", {
        description: "An unexpected error occurred."
      });
    }
  };

  const handleReprint = async (recordId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/imports/reprint/${recordId}`, { method: 'POST' });
      if (res.ok) {
        toast.success("Reprint Successful", {
          description: "Label has been sent to printer."
        });
      } else {
        toast.error("Reprint Failed", {
          description: "Could not reprint the label."
        });
      }
    } catch (error) {
      console.error("Reprint error:", error);
      toast.error("Error", { description: "Network error occurred" });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading batches...</p>
        </div>
      </div>
    );
  }

  // No batches state
  if (activeBatches.length === 0 && completedBatches.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No Batches Found</h3>
        <p className="text-slate-500">Create a batch in the "Create Batches" tab to get started.</p>
      </div>
    );
  }

  // Batch Selection View
  if (!selectedBatch) {
    return (
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="active">
            Active Work ({activeBatches.length})
          </TabsTrigger>
          <TabsTrigger value="archive">
            Completed Archive ({completedBatches.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {activeBatches.map(batch => (
              <Card 
                key={batch.id} 
                className="cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                onClick={() => loadBatchRecords(batch, false)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{batch.name || `Batch ${batch.id.slice(0,8)}`}</CardTitle>
                    <p className="text-sm text-slate-500">
                      Date Range: {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Active</Badge>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="archive">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {completedBatches.map(batch => (
              <Card 
                key={batch.id} 
                className="cursor-pointer hover:ring-2 hover:ring-green-500 transition-all opacity-75 hover:opacity-100"
                onClick={() => loadBatchRecords(batch, true)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{batch.name || `Batch ${batch.id.slice(0,8)}`}</CardTitle>
                    <p className="text-sm text-slate-500">
                      Date Range: {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-green-500 w-5 h-5" />
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    );
  }

  // Production Line View
  const activePatient = queue[currentIndex];
  //const isBatchComplete = queue.length === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <Button variant="ghost" onClick={() => setSelectedBatch(null)}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Batches
        </Button>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase">
            {isArchivedView ? 'Archived Batch' : 'Current Batch'}
          </p>
          <p className="font-semibold text-blue-600">{selectedBatch.name || `Batch ${selectedBatch.id.slice(0,8)}`}</p>
          <p className="text-xs text-slate-500">
            Range: {new Date(selectedBatch.startDate).toLocaleDateString()} - {new Date(selectedBatch.endDate).toLocaleDateString()}
          </p>
          {isArchivedView && (
            <Badge className="mt-1 bg-green-100 text-green-700">Completed</Badge>
          )}
        </div>
      </div>

      {isArchivedView ? (
        // Archived Batch View - Show all records
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Archived Records
            </CardTitle>
            <p className="text-sm text-slate-500">
              All records from this completed batch. Click "Reprint" to print a label again.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-slate-500">Patient</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500">Regimen</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500">Location</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allBatchRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{rec.firstName} {rec.lastName}</p>
                            <p className="text-xs text-slate-400 font-mono">{rec.patientUniqueId}</p>
                          </div>
                        </td>
                        <td className="p-3 text-sm">{rec.regimen}</td>
                        <td className="p-3 text-sm">{rec.collectionLocation}</td>
                        <td className="p-3">
                          {rec.status === 'PRINTED' ? (
                            <Badge className="bg-green-100 text-green-700">Printed</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs gap-2"
                            onClick={() => handleReprint(rec.id)}
                          >
                            <RefreshCw className="w-3 h-3" /> Reprint
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Active Batch View - Show production line
        <>
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
                  disabled={printing}
                >
                  <Printer className="w-10 h-10" />
                  CONFIRM & PRINT
                </Button>
                <p className="text-center text-sm text-slate-400">
                  Item {currentIndex + 1} of {queue.length} pending in this batch
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-green-50 border-green-200 p-10 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800">Batch Complete!</h2>
              <p className="text-green-700">All patients in this batch have been processed.</p>
              <Button className="mt-4" onClick={() => setSelectedBatch(null)}>
                Back to Batches
              </Button>
            </Card>
          )}

          {/* Reprint / History Section for Active Batches */}
          {allBatchRecords.length > 0 && (
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
                          {rec.status === 'PRINTED' && (
                            <Badge className="text-[10px] h-4 bg-green-100 text-green-700">Printed</Badge>
                          )}
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
          )}
        </>
      )}
    </div>
  );
}