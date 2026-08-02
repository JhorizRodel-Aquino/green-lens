import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function RequireNotLguAgent() {
    const { user } = useAuth();
    if (user?.role === 'LGU_AGENT') {
        return <Navigate to="/admin" replace />;
    }
    return <Outlet />;
}
