import './App.css';
import 'leaflet/dist/leaflet.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/components/ui/Notifications';
import UserPage from '@/pages/user/UserPage';
import IconGallery from '@/pages/IconGallery';
import LoginPage from '@/pages/LoginPage';
import RequireAuth from '@/components/layout/RequireAuth';
import AdminLayout from '@/components/layout/AdminLayout';
import DashboardPage from '@/pages/admin/DashboardPage';
import MapViewPage from '@/pages/admin/MapViewPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import ReportDetailPage from '@/pages/admin/ReportDetailPage';
import AnalyticsPage from '@/pages/admin/AnalyticsPage';
import UsersPage from '@/pages/admin/UsersPage';
import SettingsPage from '@/pages/admin/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<UserPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="map" element={<MapViewPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="/icons" element={<IconGallery />} />
        </Routes>
      </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;