import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppFooter from './components/AppFooter';
import PlatformNav from './components/platform/PlatformNav';
import { getCurrentInitiativeId } from './lib/initiativesSession';
import Login from './pages/Login';
import DashboardPage from './pages/DashboardPage';
import UnderstandingPage from './pages/UnderstandingPage';
import UxAgentAnalysisPage from './pages/UxAgentAnalysisPage';
import IdeacionPage from './pages/IdeacionPage';
import SolutionIterationPage from './pages/SolutionIterationPage';
import UserFlowPage from './pages/UserFlowPage';
import WireframesHiFiPage from './pages/WireframesHiFiPage';
import FigmaDesignPage from './pages/FigmaDesignPage';
import CodigoMuiPage from './pages/CodigoMuiPage';
import HandoffPage from './pages/HandoffPage';
import ProjectSummaryPage from './pages/ProjectSummaryPage';

function RequireAuth() {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 text-sm">
                Cargando sesión…
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }
    return <Outlet />;
}

function RequireActiveInitiative() {
    if (!getCurrentInitiativeId()) {
        return <Navigate to="/" replace />;
    }
    return <Outlet />;
}

function AuthenticatedLayout() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
            <PlatformNav />
            <Outlet />
            <AppFooter />
        </div>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RequireAuth />}>
                <Route element={<AuthenticatedLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="iniciativa/nueva" element={<UnderstandingPage />} />
                    <Route element={<RequireActiveInitiative />}>
                        <Route path="analisis" element={<UxAgentAnalysisPage />} />
                        <Route path="ideacion" element={<IdeacionPage />} />
                        <Route path="ideacion/iterar/:solutionIndex" element={<SolutionIterationPage />} />
                        <Route path="user-flow" element={<UserFlowPage />} />
                        <Route path="wireframes-hifi" element={<WireframesHiFiPage />} />
                        <Route path="figma" element={<FigmaDesignPage />} />
                        <Route path="codigo-mui" element={<CodigoMuiPage />} />
                        <Route path="handoff" element={<HandoffPage />} />
                        <Route path="resumen" element={<ProjectSummaryPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Route>
        </Routes>
    );
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
    const tree = (
        <BrowserRouter
            future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
            }}
        >
            <AuthProvider>
                <ToastProvider>
                    <AppRoutes />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
    if (googleClientId) {
        return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
    }
    return tree;
}
