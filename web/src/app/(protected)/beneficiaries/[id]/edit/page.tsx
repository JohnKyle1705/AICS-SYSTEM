import BeneficiaryForm from '@/components/BeneficiaryForm'

export default async function EditBeneficiaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-5" id="edit-beneficiary-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Edit Beneficiary</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Update beneficiary information</p>
      </div>
      <BeneficiaryForm beneficiaryId={id} />
    </div>
  )
}
