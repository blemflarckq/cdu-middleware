/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImportView } from './ImportView'

interface ImportTabProps {
  onImportSuccess?: () => void
}

export function ImportTab({ onImportSuccess }: ImportTabProps) {
  return (
    <section className="bg-white p-6 rounded-xl border shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Prescription Intake</h2>
        <p className="text-sm text-slate-500">Upload the daily CSV from Bonolo to stage new records.</p>
      </div>
      <ImportView onCommitSuccess={onImportSuccess} />
    </section>
  )
}