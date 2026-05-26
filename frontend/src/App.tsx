import { useState } from 'react'
import { ImportTab } from './components/ImportTab'
import { BatchingTab } from './components/BatchingTab'
import { ProductionMode } from './components/ProductionMode'
import { BoxingStation } from './components/BoxingStation'
import { AdminPanel } from './components/AdminPanel'
import { Toaster } from "sonner"
import { Button } from "@/components/ui/button"
import { Settings } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState<'import' | 'batching' | 'production' | 'boxing' | 'admin'>('import')
  const [refreshKey, setRefreshKey] = useState(0)
  const handleRefresh = () => setRefreshKey(prev => prev + 1)

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
            1. Import Data
          </Button>
          <Button 
            variant={activeTab === 'batching' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('batching')}
          >
            2. Create Batches
          </Button>
          <Button 
            variant={activeTab === 'production' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('production')}
          >
            3. Production Line
          </Button>
          <Button 
            variant={activeTab === 'boxing' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('boxing')}
          >
            4. Boxing Station
          </Button>
          <Button 
            variant={activeTab === 'admin' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('admin')}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Admin
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {activeTab === 'import' && (
          <ImportTab onImportSuccess={handleRefresh} />
        )}
        
        {activeTab === 'batching' && (
          <BatchingTab key={refreshKey} onBatchCreated={handleRefresh} />
        )}
        
        {activeTab === 'production' && (
          <ProductionMode />
        )}
        
        {activeTab === 'boxing' && (
          <BoxingStation />
        )}

        {activeTab === 'admin' && (
          <AdminPanel />
        )}
      </main>

      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}

export default App