/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                agent: {
                    purple: '#667eea',
                    violet: '#764ba2',
                },
            },
            backgroundImage: {
                'agent-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            },
        },
    },
    plugins: [],
};
