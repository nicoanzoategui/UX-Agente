/** Columnas del tablero (tareas y tarjeta padre en transcripción). */
export type KanbanColumn = 'todo' | 'wip' | 'review' | 'done';

/** Paso global del kickoff (una máquina de estados por tarjeta). */
export type FlowStep =
    | 'transcript'
    | 'spec_generating'
    | 'gate_spec'
    | 'wireframes_generating'
    | 'gate_wireframes'
    | 'hifi_generating'
    | 'gate_hifi'
    | 'flowbite_generating'
    | 'gate_flowbite'
    | 'completed';
