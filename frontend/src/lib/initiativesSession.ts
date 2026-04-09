const INITIATIVES_KEY = 'ux-agent-initiatives-v1';
const CURRENT_ID_KEY = 'ux-agent-current-initiative-id-v1';

export type InitiativeRecord = {
    id: string;
    createdAt: string;
    updatedAt: string;
    completed: boolean;
};

export function loadInitiativeRecords(): InitiativeRecord[] {
    try {
        const raw = sessionStorage.getItem(INITIATIVES_KEY);
        if (!raw) return [];
        const p = JSON.parse(raw) as unknown;
        if (!Array.isArray(p)) return [];
        return p.filter(
            (x): x is InitiativeRecord =>
                x &&
                typeof x === 'object' &&
                typeof (x as InitiativeRecord).id === 'string' &&
                typeof (x as InitiativeRecord).createdAt === 'string' &&
                typeof (x as InitiativeRecord).updatedAt === 'string' &&
                typeof (x as InitiativeRecord).completed === 'boolean'
        );
    } catch {
        return [];
    }
}

export function saveInitiativeRecords(list: InitiativeRecord[]): void {
    try {
        sessionStorage.setItem(INITIATIVES_KEY, JSON.stringify(list));
    } catch {
        /* ignore */
    }
}

export function getCurrentInitiativeId(): string | null {
    try {
        const id = sessionStorage.getItem(CURRENT_ID_KEY);
        return id?.trim() || null;
    } catch {
        return null;
    }
}

export function setCurrentInitiativeId(id: string | null): void {
    try {
        if (id) sessionStorage.setItem(CURRENT_ID_KEY, id);
        else sessionStorage.removeItem(CURRENT_ID_KEY);
    } catch {
        /* ignore */
    }
}

export function createNewInitiative(): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const list = loadInitiativeRecords();
    list.unshift({ id, createdAt: now, updatedAt: now, completed: false });
    saveInitiativeRecords(list);
    setCurrentInitiativeId(id);
    return id;
}

export function touchInitiativeRecord(id: string): void {
    const list = loadInitiativeRecords();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return;
    list[idx] = { ...list[idx], updatedAt: new Date().toISOString() };
    saveInitiativeRecords(list);
}

export function setInitiativeCompleted(id: string, completed: boolean): void {
    const list = loadInitiativeRecords();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return;
    list[idx] = { ...list[idx], completed, updatedAt: new Date().toISOString() };
    saveInitiativeRecords(list);
}

/** Asegura que exista registro para un id (p. ej. tras migración). */
export function ensureInitiativeRecord(id: string): void {
    const list = loadInitiativeRecords();
    if (list.some((r) => r.id === id)) return;
    const now = new Date().toISOString();
    list.unshift({ id, createdAt: now, updatedAt: now, completed: false });
    saveInitiativeRecords(list);
}
