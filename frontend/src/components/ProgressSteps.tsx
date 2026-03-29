interface Props {
    currentLevel: number;
    approvedLevels: number[];
}

const STEPS = [
    { level: 1, name: 'Wireframe', description: 'Layout básico' },
    { level: 2, name: 'Wireframe Alta', description: 'Con tipografía' },
    { level: 3, name: 'UI High-Fi', description: 'Código final' },
];

export default function ProgressSteps({ currentLevel, approvedLevels }: Props) {
    return (
        <div className="flex items-center justify-between bg-white border border-[#DFE1E6] rounded-[3px] p-6 shadow-sm">
            {STEPS.map((step, index) => {
                const isApproved = approvedLevels.includes(step.level);
                const isCurrent = currentLevel === step.level;

                return (
                    <div key={step.level} className="flex items-center flex-1">
                        {/* Step */}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isApproved
                                ? 'bg-[#36B37E] text-white'
                                : isCurrent
                                    ? 'bg-[#0052CC] text-white shadow-[0_0_10px_rgba(0,82,204,0.3)]'
                                    : 'bg-[#EBECF0] text-[#5E6C84]'
                                }`}>
                                {isApproved ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step.level
                                )}
                            </div>
                            <div className="hidden sm:block">
                                <div className={`font-bold text-xs uppercase tracking-wider ${isApproved || isCurrent ? 'text-[#172B4D]' : 'text-[#7A869A]'
                                    }`}>
                                    {step.name}
                                </div>
                                <div className="text-[10px] text-[#5E6C84] whitespace-nowrap font-medium">{step.description}</div>
                            </div>
                        </div>

                        {/* Connector */}
                        {index < STEPS.length - 1 && (
                            <div className={`h-1 mx-4 flex-1 rounded-full ${approvedLevels.includes(step.level) ? 'bg-[#36B37E]' : 'bg-[#EBECF0]'
                                }`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
