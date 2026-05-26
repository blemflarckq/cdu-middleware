/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { FileUploader } from "./FileUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface StagedResult {
  staged: any[];
  errors: any[];
}

interface ImportViewProps {
  onCommitSuccess?: () => void; // The '?' means it's optional
}

export function ImportView({ onCommitSuccess }: ImportViewProps) {
  const [results, setResults] = useState<StagedResult | null>(null);

  const handleFileParsed = (validationResult: { staged: any[], errors: any[] }) => {
  // The FileUploader already called validate and returned the result
  // Just set the results directly - don't call validate again!
  console.log('Received validation result from FileUploader:', validationResult);
  setResults(validationResult);
  
  // Show feedback based on validation results
  if (validationResult.errors?.length > 0) {
    toast.warning("Validation Complete", {
      description: `${validationResult.staged.length} valid, ${validationResult.errors.length} rows skipped.`
    });
  } else {
    toast.success("Validation Complete", {
      description: `${validationResult.staged.length} records ready for import.`
    });
  }
};

  const handleConfirmImport = async () => {
    if (!results) return;
    
    const loadingToast = toast.loading("Importing records...");
    
    try {
      const res = await fetch("http://localhost:3000/imports/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: results.staged }),
      });

      toast.dismiss(loadingToast);

      if (res.ok) {
        toast.success("Import Successful", {
          description: `${results.staged.length} records saved.`
        });
        setResults(null); // Clear the staging area

        if (onCommitSuccess) {
          onCommitSuccess();
        }

      } else {
        toast.error("Import Failed", {
          description: "Could not save records to database."
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Import Failed", {
        description: "An unexpected error occurred."
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {!results && <FileUploader onUpload={handleFileParsed} />}

      {results && (
        <div className="space-y-6">
          {/* Success / Staging Table */}
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Ready for Import
                </CardTitle>
                <p className="text-sm text-green-600">Review computed dates and name splits below.</p>
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setResults(null)}>Cancel</Button>
                <Button onClick={handleConfirmImport} className="bg-green-700">Commit {results.staged.length} Records</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Regimen</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-blue-600 font-bold">Next Pickup (Computed)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.staged.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.firstName}</TableCell>
                        <TableCell>{r.lastName}</TableCell>
                        <TableCell className="text-xs">{r.regimen}</TableCell>
                        <TableCell>{r.primaryContact}</TableCell>
                        <TableCell className="font-mono text-blue-700">{r.nextDrugPickupDate}</TableCell>
                      </TableRow>
                    ))}
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