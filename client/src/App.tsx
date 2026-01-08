import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';
import GameDetailPage from './pages/GameDetailPage';
import AdminPage from './pages/AdminPage';
import CoverAuditPage from './pages/CoverAuditPage';

function App() {
  return (
    <div className="h-full flex flex-col bg-steam-bg">
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/game/:slug" element={<GameDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/covers" element={<CoverAuditPage />} />
      </Routes>
    </div>
  );
}

export default App;
