import BeneficiaryForm from '@/components/BeneficiaryForm'

export default function NewBeneficiaryPage() {
  return (
    <div className="space-y-5" id="new-beneficiary-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Add Beneficiary</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Register a new AICS beneficiary</p>
      </div>
      <BeneficiaryForm />
    </div>
  )
}
