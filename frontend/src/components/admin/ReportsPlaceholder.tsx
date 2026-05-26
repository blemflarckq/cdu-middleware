import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, BarChart3, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export function ReportsPlaceholder() {
  const handleComingSoon = () => {
    toast.info('Coming Soon', {
      description: 'Reports feature is currently under development.'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reports Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Report Type 1 */}
            <div className="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={handleComingSoon}>
              <FileText className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Patient Summary</h3>
              <p className="text-sm text-slate-500">View patient records, dispensing history, and adherence tracking</p>
              <Button variant="outline" className="mt-4" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </div>

            {/* Report Type 2 */}
            <div className="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={handleComingSoon}>
              <BarChart3 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Batch Performance</h3>
              <p className="text-sm text-slate-500">Analyze batch processing times and productivity metrics</p>
              <Button variant="outline" className="mt-4" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </div>

            {/* Report Type 3 */}
            <div className="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={handleComingSoon}>
              <TrendingUp className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Inventory Analytics</h3>
              <p className="text-sm text-slate-500">Track drug consumption patterns and stock predictions</p>
              <Button variant="outline" className="mt-4" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleComingSoon}>
              <Download className="w-4 h-4 mr-2" />
              Export Patient Data (CSV)
            </Button>
            <Button variant="outline" onClick={handleComingSoon}>
              <Download className="w-4 h-4 mr-2" />
              Export Batch History (Excel)
            </Button>
            <Button variant="outline" onClick={handleComingSoon}>
              <Download className="w-4 h-4 mr-2" />
              Export Inventory Report (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}