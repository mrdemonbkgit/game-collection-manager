import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';
import GameDetailPage from './pages/GameDetailPage';
import AssetFixPage from './pages/AssetFixPage';
import AdminPage from './pages/AdminPage';
import CoverFixPage from './pages/CoverFixPage';
import SyncDashboardPage from './pages/SyncDashboardPage';

function App() {
  return (
    <div className="h-full flex flex-col bg-steam-bg">
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/game/:slug" element={<GameDetailPage />} />
        <Route path="/game/:slug/fix-assets" element={<AssetFixPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/covers" element={<CoverFixPage />} />
        <Route path="/admin/sync" element={<SyncDashboardPage />} />
      </Routes>
    </div>
  );
}

export default App;
