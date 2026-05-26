import { useState } from 'react'
import { PatientTable } from './components/PatientTable'
import { BatchCreator } from './components/BatchCreator'
import { ProductionMode } from './components/ProductionMode'
import { BoxingStation } from './components/BoxingStation'
import { ImportView } from './components/ImportView'
import { Toaster } from "sonner"
import { Button } from "@/components/ui/button"

function App() {
  const [activeTab, setActiveTab] = useState<'import' | 'production' | 'boxing'>('import')

  // This function can be passed down to refresh the PatientTable after a batch is created
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="max-w-6xl mx-auto mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Collect-N-Go</h1>
          <p className="text-xs text-slate-500 font-medium">Pharmacy Logistics & Dispensing</p>
        </div>
        
        <div className="space-x-2 bg-white p-1 rounded-lg border shadow-sm">
          <Button 
            variant={activeTab === 'import' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('import')}
          >
            1. Import & Batching
          </Button>
          <Button 
            variant={activeTab === 'production' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('production')}
          >
            2. Production Line
          </Button>
          <Button 
            variant={activeTab === 'boxing' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('boxing')}
          >
            3. Boxing Station
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {activeTab === 'import' && (
          <div className="flex flex-col gap-12">
            
            {/* SECTION 1: THE INTAKE GATE (IMPORT) */}
            <section className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">1. Prescription Intake</h2>
                <p className="text-sm text-slate-500">Upload the daily CSV from Bonolo to stage new records.</p>
              </div>
              <ImportView onCommitSuccess={handleRefresh} />
            </section>

            {/* SECTION 2: THE QUEUE & BATCHING (MANAGEMENT) */}
            <section className="space-y-6">
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* Left Side: The "Inbox" Table */}
                <div className="flex-[2] w-full space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">2. Unprocessed Queue</h2>
                      <p className="text-sm text-slate-500">Patients waiting to be assigned to a batch.</p>
                    </div>
                  </div>
                  <PatientTable key={refreshKey} />
                </div>

                {/* Right Side: The "Action" Card */}
                <div className="flex-1 w-full lg:max-w-sm">
                  <div className="sticky top-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Create Batch</h2>
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl shadow-sm">
                        <p className="text-xs text-blue-700 mb-4 font-medium uppercase">Step: Assign to Logistics</p>
                        <BatchCreator onBatchCreated={handleRefresh} />
                    </div>
                    <div className="mt-4 p-4 bg-slate-100 rounded-lg text-[11px] text-slate-500 italic">
                      Tip: Creating a batch moves these records to the "Production Line" tab.
                    </div>
                  </div>
                </div>

              </div>
            </section>
          </div>
        )}

        {activeTab === 'production' && (
          <ProductionMode />
        )}

        {activeTab === 'boxing' && (
          <BoxingStation />
        )}
      </main>

      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}

export default App