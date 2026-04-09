type Props = {
    currentStep: 1 | 2 | 3 | 4;
};

const LABELS = ['Entendimiento', 'Ideación', 'Prototipado', 'Handoff'] as const;

export default function ProgressBar({ currentStep }: Props) {
    return (
        <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Progreso de la iniciativa</h2>
                <span className="text-sm text-gray-600">
                    Paso {currentStep} de 4
                </span>
            </div>
            <div className="flex items-center space-x-2">
                {([1, 2, 3, 4] as const).map((n) => (
                    <div
                        key={n}
                        className={`flex-1 h-2 rounded transition-all ${
                            n <= currentStep ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                    />
                ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
                {LABELS.map((label) => (
                    <span key={label}>{label}</span>
                ))}
            </div>
        </div>
    );
}
