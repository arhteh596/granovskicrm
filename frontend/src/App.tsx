import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { Login, AdminUsers, AdminDatabases, AdminDatabasesWiki, AdminPanel, ManagerCall, Profile, Statistics, Mamonty, Katka, TelegramAuth, Wiki } from './pages';
import { Layout } from './components/Layout';
import { useEffect } from 'react';
import apiClient from './services/api';
import { subscribePush } from './utils/push';

function App() {
    const { user, isAuthenticated } = useAuthStore();
    useEffect(() => {
        // Автоподписка на пуши после логина
        const setup = async () => {
            try {
                if (!isAuthenticated) return;
                const vapidKey = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
                if (!vapidKey) return;
                const sub = await subscribePush(vapidKey);
                if (sub) {
                    await apiClient.post('/push/subscribe', sub.toJSON());
                }
            } catch (e) {
                // no-op
            }
        };
        setup();
    }, [isAuthenticated]);

    const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
        if (!isAuthenticated) {
            return <Navigate to="/login" replace />;
        }

        if (allowedRoles && user && !allowedRoles.includes(user.role)) {
            return <Navigate to="/" replace />;
        }

        return <>{children}</>;
    };

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Toaster
                position="top-right"
                toastOptions={{
                    // Унификация под тему CRM
                    duration: 5000,
                    style: {
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.06) 100%)',
                        color: 'var(--color-text-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '14px',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                        backdropFilter: 'blur(6px)'
                    },
                    success: {
                        iconTheme: {
                            primary: 'var(--color-accent)',
                            secondary: '#fff'
                        }
                    },
                    error: {
                        iconTheme: {
                            primary: '#dc2626',
                            secondary: '#fff'
                        }
                    }
                }}
            />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/telegram-demo" element={<TelegramAuth />} />

                <Route element={<Layout />}>
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                {user?.role === 'admin' ? (
                                    <Navigate to="/call" replace />
                                ) : (
                                    <Navigate to="/call" replace />
                                )}
                            </ProtectedRoute>
                        }
                    />

                    {/* Admin Routes */}
                    <Route
                        path="/admin/users"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <AdminUsers />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/databases"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <AdminDatabases />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/panel"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <AdminPanel />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/databases-wiki"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <AdminDatabasesWiki />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/statistics"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <Statistics />
                            </ProtectedRoute>
                        }
                    />

                    {/* Manager & Admin Routes */}
                    <Route
                        path="/call"
                        element={
                            <ProtectedRoute allowedRoles={['manager', 'admin', 'zakryv']}>
                                <ManagerCall />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/wiki"
                        element={
                            <ProtectedRoute allowedRoles={['manager', 'admin', 'zakryv']}>
                                <Wiki />
                            </ProtectedRoute>
                        }
                    />

                    {/* Zakryv & Admin Routes */}
                    <Route
                        path="/mamonty"
                        element={
                            <ProtectedRoute allowedRoles={['zakryv']}>
                                <Mamonty />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/katka"
                        element={
                            <ProtectedRoute allowedRoles={['zakryv', 'admin']}>
                                <Katka />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <Profile />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/statistics"
                        element={
                            <ProtectedRoute>
                                <Statistics />
                            </ProtectedRoute>
                        }
                    />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
