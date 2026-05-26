/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface FileUploaderProps {
  onUpload?: (data: { staged: any[], errors: any[] }) => Promise<void> | void;
}

export const FileUploader = ({ onUpload }: FileUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file || loading) return;
    setLoading(true);

    try {
      // Parse the file using xlsx (browser version)
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      //const rows = XLSX.utils.sheet_to_json(worksheet);
      
      console.log('🚀 FileUploader: Sending request to validate endpoint');
      console.log('🚀 rows is array?', Array.isArray(rows));

      // Send to backend validation endpoint
      const response = await fetch('http://localhost:3000/imports/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rows }),
      });

      if (response.ok) {
        const validationResult = await response.json();
        toast.success("Validation Complete", { 
          description: `Found ${validationResult.staged.length} valid records.` 
        });

        if (onUpload) {
          await onUpload(validationResult);
        }
      } else {
        const error = await response.json();
        toast.error("Validation Error", { 
          description: error.message || "Server failed to process rows" 
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Processing Error", { 
        description: "Failed to read the file. Please ensure it's a valid Excel or CSV file." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Step 1: Select CSV/XLSX</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input 
          type="file" 
          accept=".csv, .xlsx, .xls" 
          onChange={(e) => setFile(e.target.files?.[0] || null)} 
        />
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700" 
          onClick={handleUpload} 
          disabled={!file || loading}
        >
          {loading ? "Processing..." : "Parse & Validate"}
        </Button>
      </CardContent>
    </Card>
  );
};
