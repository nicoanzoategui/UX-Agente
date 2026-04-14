type Props = {
    currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

const LABELS = [
    'Entendimiento',
    'Ideación',
    'User flow',
    'Wireframes HiFi',
    'Figma',
    'Código TSX',
    'Handoff',
] as const;

const STEP_COUNT = 7 as const;

export default function ProgressBar({ currentStep }: Props) {
    return (
        <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Progreso de la iniciativa</h2>
                <span className="text-sm text-gray-600">
                    Paso {currentStep} de {STEP_COUNT}
                </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
                {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
                    <div
                        key={n}
                        className={`flex-1 h-2 rounded transition-all ${n <= currentStep ? 'bg-purple-600' : 'bg-gray-200'}`}
                    />
                ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-gray-500 gap-0.5 overflow-x-auto">
                {LABELS.map((label) => (
                    <span key={label} className="text-center min-w-0 truncate sm:whitespace-normal">
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}
