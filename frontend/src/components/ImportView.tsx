/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { FileUploader } from "./FileUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, XCircle, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

interface StagedResult {
  staged: any[];
  errors: any[];
}

interface ImportViewProps {
  onCommitSuccess?: () => void;
}

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  externalId: string;
}

export function ImportView({ onCommitSuccess }: ImportViewProps) {
  const [results, setResults] = useState<StagedResult | null>(null);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPickupPoints, setSelectedPickupPoints] = useState<Record<number, string>>({});
  const [isCommitting, setIsCommitting] = useState(false);

  // Load pickup points for dropdown
  useEffect(() => {
    const loadPickupPoints = async () => {
      try {
        const res = await fetch("http://localhost:3000/admin/pickup-points");
        if (res.ok) {
          const data = await res.json();
          setPickupPoints(data);
        }
      } catch (error) {
        console.error("Failed to load pickup points:", error);
      }
    };
    loadPickupPoints();
  }, []);

  const handleFileParsed = (validationResult: { staged: any[], errors: any[] }) => {
    console.log('Received validation result from FileUploader:', validationResult);
    setResults(validationResult);
    
    // Initialize selected pickup points for each staged record
    const initialSelections: Record<number, string> = {};
    validationResult.staged.forEach((record, index) => {
      // If the record already has a drugPickupPointId (from backend matching), pre-select it
      if (record.drugPickupPointId) {
        initialSelections[index] = record.drugPickupPointId;
      }
    });
    setSelectedPickupPoints(initialSelections);

    // Show feedback
    if (validationResult.errors?.length > 0) {
      toast.warning("Validation Complete with Errors", {
        description: `${validationResult.staged.length} valid, ${validationResult.errors.length} rows with issues.`
      });
    } else {
      toast.success("Validation Complete", {
        description: `${validationResult.staged.length} records ready for import.`
      });
    }
  };

  const handlePickupPointChange = (index: number, pickupPointId: string) => {
    setSelectedPickupPoints(prev => ({
      ...prev,
      [index]: pickupPointId
    }));
  };

  // Check if a record has a valid pickup point selected
  const hasValidPickupPoint = (index: number) => {
    return !!selectedPickupPoints[index];
  };

  // Check if all records have pickup points selected
  const allRecordsHavePickupPoints = () => {
    if (!results) return false;
    return results.staged.every((_, index) => hasValidPickupPoint(index));
  };

  const handleConfirmImport = async () => {
    if (!results) return;
    
    // Check if all records have a pickup point selected
    if (!allRecordsHavePickupPoints()) {
      toast.error("Error", { 
        description: "Please select a Drug Pickup Point for ALL records before committing." 
      });
      return;
    }

    // Build the commit data with selected pickup points
    const recordsWithPickupPoints = results.staged.map((record, index) => ({
      ...record,
      drugPickupPointId: selectedPickupPoints[index]
    }));

    setIsCommitting(true);
    const loadingToast = toast.loading("Importing records...");
    
    try {
      const res = await fetch("http://localhost:3000/imports/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: recordsWithPickupPoints }),
      });

      toast.dismiss(loadingToast);

      if (res.ok) {
        toast.success("Import Successful", {
          description: `${results.staged.length} records saved.`
        });
        setResults(null);
        setSelectedPickupPoints({});

        if (onCommitSuccess) {
          onCommitSuccess();
        }
      } else {
        const error = await res.json();
        toast.error("Import Failed", {
          description: error.message || "Could not save records to database."
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Import Failed", {
        description: "An unexpected error occurred."
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Get the name of a pickup point by ID
  const getPickupPointName = (id: string) => {
    const point = pickupPoints.find(p => p.id === id);
    return point?.name || 'Unknown';
  };

  // Check if a record already had a match from backend
  const hadBackendMatch = (record: any) => {
    return !!record.drugPickupPointId;
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {!results && <FileUploader onUpload={handleFileParsed} />}

      {results && (
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">{results.staged.length} records</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  Pickup Points: 
                  <span className={`ml-1 font-medium ${allRecordsHavePickupPoints() ? 'text-green-600' : 'text-yellow-600'}`}>
                    {allRecordsHavePickupPoints() ? '✅ All assigned' : `⚠️ ${results.staged.filter((_, i) => !hasValidPickupPoint(i)).length} missing`}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResults(null)}>Cancel</Button>
              <Button 
                onClick={handleConfirmImport} 
                className="bg-green-700 hover:bg-green-800"
                disabled={isCommitting || !allRecordsHavePickupPoints()}
              >
                {isCommitting ? "Importing..." : `Commit ${results.staged.length} Records`}
              </Button>
            </div>
          </div>

          {/* Success / Staging Table */}
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center gap-2 text-lg">
                <CheckCircle2 className="w-5 h-5" /> Review & Assign Pickup Points
              </CardTitle>
              <p className="text-sm text-green-600">
                Records with pickup points already matched are shown in green. Please select a pickup point for any records with warnings.
              </p>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto rounded-md border bg-white">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                    <TableRow>
                      <TableHead className="w-[20px]">#</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Regimen</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-blue-600 font-bold">Next Pickup</TableHead>
                      <TableHead className="min-w-[220px]">Drug Pickup Point</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.staged.map((r, index) => {
                      const isMatched = hadBackendMatch(r) || hasValidPickupPoint(index);
                      const selectedName = selectedPickupPoints[index] ? getPickupPointName(selectedPickupPoints[index]) : '';
                      
                      return (
                        <TableRow 
                          key={index} 
                          className={!isMatched ? 'border-l-4 border-l-yellow-400 bg-yellow-50/30' : ''}
                        >
                          <TableCell className="text-center">
                            {isMatched ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-500" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{r.firstName}</TableCell>
                          <TableCell>{r.lastName}</TableCell>
                          <TableCell className="text-xs">{r.regimen}</TableCell>
                          <TableCell>{r.primaryContact}</TableCell>
                          <TableCell className="font-mono text-blue-700">{r.nextDrugPickupDate}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Select
                                value={selectedPickupPoints[index] || ''}
                                onValueChange={(value) => handlePickupPointChange(index, value)}
                              >
                                <SelectTrigger 
                                  className={`w-full ${!isMatched ? 'border-yellow-400 bg-yellow-50 focus:ring-yellow-500' : 'border-green-300 bg-green-50'}`}
                                >
                                  <SelectValue placeholder="Select pickup point..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {pickupPoints.map((point) => (
                                    <SelectItem key={point.id} value={point.id}>
                                      {point.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <div className="flex items-center justify-between">
                                {/* Show the original name from the file */}
                                {r.drugPickupPoint && (
                                  <p className="text-xs text-slate-400 truncate max-w-[180px]">
                                    📄 From file: {r.drugPickupPoint}
                                  </p>
                                )}
                                
                                {/* Show match status */}
                                {selectedPickupPoints[index] && (
                                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {r.drugPickupPoint ? 'Matched' : 'Assigned'}
                                  </span>
                                )}
                                {!selectedPickupPoints[index] && (
                                  <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Required
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Error Table (Rows that failed mandatory checks) */}
          {results.errors.length > 0 && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2 text-md">
                  <XCircle className="w-5 h-5" /> Skipped Rows ({results.errors.length})
                </CardTitle>
                <p className="text-sm text-red-600">The following rows are missing mandatory fields and will not be imported.</p>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto rounded-md border bg-white">
                  <Table>
                    <TableBody>
                      {results.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-bold text-red-500">Line {err.line}</TableCell>
                          <TableCell className="text-xs">{err.name || "Unknown Patient"}</TableCell>
                          <TableCell className="text-xs text-slate-500 italic">Missing: {err.missing.join(", ")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}