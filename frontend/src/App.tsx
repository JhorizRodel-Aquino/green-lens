import './App.css';
import 'leaflet/dist/leaflet.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UserPage from '@/pages/user/UserPage';
import IconGallery from '@/pages/IconGallery';
import AdminPage from '@/pages/admin/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/icons" element={<IconGallery />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;