interface Props {
    story: {
        jira_key: string;
        title: string;
        status: string;
        current_level: number;
        approved_count: number;
    };
}

const LEVEL_NAMES = ['Pendiente', 'Wireframe', 'Wireframe Alta', 'UI High-Fi'];

export default function StoryCard({ story }: Props) {
    const isCompleted = story.status === 'completed';

    return (
        <div className="p-4 bg-white border border-[#DFE1E6] hover:bg-[#F4F5F7] transition-all cursor-pointer group shadow-sm first:rounded-t-[3px] last:rounded-b-[3px]">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#0052CC] font-semibold text-xs hover:underline decoration-skip-ink">
                            {story.jira_key}
                        </span>
                    </div>
                    <h3 className="text-sm font-medium text-[#172B4D] truncate group-hover:text-[#0052CC] transition-colors">
                        {story.title}
                    </h3>
                </div>

                <div className="text-right ml-4 flex-shrink-0 flex flex-col items-end">
                    {isCompleted ? (
                        <span className="bg-[#E3FCEF] text-[#006644] text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px] flex items-center gap-1">
                            Hecho
                        </span>
                    ) : (
                        <span className="bg-[#DEEBFF] text-[#0052CC] text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px]">
                            {LEVEL_NAMES[story.current_level] === 'Pendiente' ? 'En cola' : LEVEL_NAMES[story.current_level]}
                        </span>
                    )}
                    <div className="text-[10px] text-[#5E6C84] mt-1.5 font-medium">
                        {story.approved_count}/3 aprobados
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 flex gap-1 h-1.5 bg-[#EBECF0] rounded-full overflow-hidden">
                {[1, 2, 3].map(level => (
                    <div
                        key={level}
                        className={`h-full flex-1 transition-all duration-500 ${level <= story.approved_count
                            ? 'bg-[#36B37E]'
                            : level === story.current_level
                                ? 'bg-[#FFAB00] animate-pulse'
                                : 'transparent'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
