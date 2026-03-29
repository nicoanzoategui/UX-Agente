import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Review from './pages/Review';

export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-[#F4F5F7] text-[#172B4D]">
                <header className="bg-white border-b border-[#DFE1E6] sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-md bg-[#0052CC] flex items-center justify-center text-white font-bold text-xl shadow-sm">
                                D
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-[#172B4D] leading-tight">Design Agent</span>
                                <span className="text-[10px] text-[#5E6C84] uppercase tracking-wider font-semibold">Dashboard • MVP</span>
                            </div>
                        </Link>
                        <div className="flex items-center gap-6">
                            <a
                                href={`https://${import.meta.env.VITE_JIRA_HOST || 'jira.atlassian.com'}`}
                                target="_blank"
                                rel="noopener"
                                className="text-sm font-medium text-[#42526E] hover:text-[#0052CC] transition-colors"
                            >
                                Abrir Jira ↗
                            </a>
                        </div>
                    </div>
                </header>

                <main className="max-w-6xl mx-auto p-6">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/review/:storyId" element={<Review />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
