import React from 'react';

interface Props {
    currentLevel: number;
    approvedLevels: number[];
    availableLevels?: number[];
    selectedLevel?: number | null;
    onStepClick?: (level: number) => void;
}

const STEPS = [
    { level: 1, name: 'Wireframe', description: 'Estructura y layout' },
    { level: 2, name: 'Alta fidelidad', description: 'Tipografía y spacing' },
    { level: 3, name: 'UI High-Fi', description: 'Código final MUI' },
];

export default function ProgressSteps({
    currentLevel,
    approvedLevels,
    availableLevels = [],
    selectedLevel = null,
    onStepClick,
}: Props) {
    return (
        <div className="w-full">
            {STEPS.map((step, index) => {
                const isApproved = approvedLevels.includes(step.level);
                const isCurrent = currentLevel === step.level;
                const isPending = !isApproved && !isCurrent;
                const isLast = index === STEPS.length - 1;
                const isClickable = !!onStepClick && (isApproved || availableLevels.includes(step.level));
                const isSelected = selectedLevel === step.level;

                return (
                    <button
                        key={step.level}
                        type="button"
                        onClick={() => isClickable && onStepClick?.(step.level)}
                        className={`w-full text-left flex gap-3 rounded-[3px] border px-3 py-2.5 mb-2 transition-colors ${
                            isClickable ? 'hover:bg-[#F4F5F7] cursor-pointer' : 'cursor-default'
                        } ${
                            isSelected
                                ? 'bg-[#EBF2FF] border-[#4C9AFF]'
                                : 'bg-white border-[#DFE1E6]'
                        }`}
                    >
                        {/* Línea vertical + círculo */}
                        <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                                isApproved
                                    ? 'bg-[#36B37E] text-white'
                                    : isCurrent
                                        ? 'bg-[#0052CC] text-white ring-4 ring-[#0052CC]/20'
                                        : 'bg-[#EBECF0] text-[#7A869A]'
                            }`}>
                                {isApproved ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step.level
                                )}
                            </div>
                            {!isLast && (
                                <div className={`w-0.5 flex-1 my-1 rounded-full min-h-[24px] ${
                                    isApproved ? 'bg-[#36B37E]' : 'bg-[#EBECF0]'
                                }`} />
                            )}
                        </div>

                        {/* Contenido */}
                        <div className="pb-1">
                            <div className={`text-xs font-bold uppercase tracking-wider leading-5 ${
                                isApproved ? 'text-[#36B37E]'
                                : isCurrent ? 'text-[#0052CC]'
                                : 'text-[#7A869A]'
                            }`}>
                                {step.name}
                                {isCurrent && (
                                    <span className="ml-2 normal-case font-medium tracking-normal bg-[#DEEBFF] text-[#0052CC] px-1.5 py-0.5 rounded-[3px] text-[10px]">
                                        En revisión
                                    </span>
                                )}
                                {isApproved && (
                                    <span className="ml-2 normal-case font-medium tracking-normal bg-[#E3FCEF] text-[#006644] px-1.5 py-0.5 rounded-[3px] text-[10px]">
                                        Aprobado
                                    </span>
                                )}
                            </div>
                            <div className={`text-[11px] ${isPending ? 'text-[#B3BAC5]' : 'text-[#5E6C84]'}`}>
                                {step.description}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}