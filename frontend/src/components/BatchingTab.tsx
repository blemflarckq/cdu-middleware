import { PatientTable } from './PatientTable'
import { BatchCreator } from './BatchCreator'

interface BatchingTabProps {
  onBatchCreated: () => void
}

export function BatchingTab({ onBatchCreated }: BatchingTabProps) {
  return (
    <div className="space-y-8">
      {/* Batch Creator Section - Now on top */}
      <section className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Create New Batch</h2>
        <p className="text-sm text-slate-500 mb-4">Select a collection date to create a batch from eligible records.</p>
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
          <BatchCreator onBatchCreated={onBatchCreated} />
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
          ℹ️ Tip: Creating a batch moves selected records to the "Production Line" tab for processing.
        </div>
      </section>

      {/* Patient Queue Section - Below */}
      <section className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">Unprocessed Queue</h2>
          <p className="text-sm text-slate-500">Patients waiting to be assigned to a batch.</p>
        </div>
        <PatientTable />
      </section>
    </div>
  )
}