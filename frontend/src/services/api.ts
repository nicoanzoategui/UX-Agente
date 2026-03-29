const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchAPI(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || 'API Error');
    }

    return response.json();
}

export const api = {
    getStories: () => fetchAPI('/api/stories'),

    getStory: (id: string) => fetchAPI(`/api/stories/${id}`),

    getPendingReviews: () => fetchAPI('/api/review/pending'),

    approve: (outputId: string) => fetchAPI(`/api/review/${outputId}/approve`, { method: 'POST' }),

    reject: (outputId: string, feedback: string) => fetchAPI(`/api/review/${outputId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
    }),

    /** Solo si la story no tiene ningún design_output (p. ej. falló Gemini tras el comentario inicial). */
    retryFirstDesign: (storyId: string) =>
        fetchAPI(`/api/stories/${storyId}/retry-first-design`, { method: 'POST' }),
};
