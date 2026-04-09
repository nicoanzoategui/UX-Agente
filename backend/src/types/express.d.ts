declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId: string;
                workspaceId: string;
                email: string;
                name: string;
            };
        }
    }
}

export {};
