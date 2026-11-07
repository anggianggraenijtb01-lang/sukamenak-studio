import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudioProvider } from './components/common/StudioContext';
import { PublicLayout } from './layouts/PublicLayout';
import { CreatorLayout } from './layouts/CreatorLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { LandingPage } from './pages/public/LandingPage';
import { Login } from './pages/public/Login';
import { Register } from './pages/public/Register';
import { Dashboard as CreatorDashboard } from './pages/creator/Dashboard';
import { StudioGenerator } from './pages/creator/StudioGenerator';
import { Gallery } from './pages/creator/Gallery';
import { HistoryPage } from './pages/creator/HistoryPage';
import { ProfilePage } from './pages/creator/ProfilePage';
import { Advisor } from './pages/creator/Advisor';
import { Tutorials } from './pages/creator/Tutorials';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { ModelManager } from './pages/admin/ModelManager';
import { CorePromptManager } from './pages/admin/CorePromptManager';
import { AdminTemplates } from './pages/admin/AdminTemplates';
import { AdminReferences } from './pages/admin/AdminReferences';
import { AdminCuration } from './pages/admin/AdminCuration';
import { AdminLogs } from './pages/admin/AdminLogs';
import { AdminPolicy } from './pages/admin/AdminPolicy';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminProfile } from './pages/admin/AdminProfile';
import { PresentationBoard } from './pages/PresentationBoard';

export const App: React.FC = () => {
  return (
    <StudioProvider>
      <BrowserRouter>
        <Routes>
          {/* Widescreen 16:9 UI/UX Presentation Board Overview */}
          <Route path="/board" element={<PresentationBoard />} />

          {/* 1. LAYOUT 1 - PINTU MASUK PUBLIK & AUTENTIKASI (#F8FAFC) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* 2. LAYOUT 2 - HALAMAN CREATOR / USER (#F8FAFC) */}
          <Route path="/creator" element={<CreatorLayout />}>
            <Route index element={<Navigate to="/creator/dashboard" replace />} />
            <Route path="dashboard" element={<CreatorDashboard />} />
            <Route path="studio" element={<StudioGenerator />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="templates" element={<Navigate to="/creator/gallery" replace />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="advisor" element={<Advisor />} />
            <Route path="tutorials" element={<Tutorials />} />
            <Route path="education" element={<Navigate to="/creator/tutorials" replace />} />
          </Route>

          {/* 3. LAYOUT 3 - PANEL CONTROL ADMIN / OPERATOR (#F8FAFC / #0F172A) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="models" element={<ModelManager />} />
            <Route path="core-prompt" element={<CorePromptManager />} />
            <Route path="templates" element={<AdminTemplates />} />
            <Route path="references" element={<AdminReferences />} />
            <Route path="curation" element={<AdminCuration />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="policy" element={<AdminPolicy />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StudioProvider>
  );
};

export default App;
