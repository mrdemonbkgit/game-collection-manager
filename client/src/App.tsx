import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';
import GameDetailPage from './pages/GameDetailPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <div className="h-full flex flex-col bg-steam-bg">
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/game/:slug" element={<GameDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}

export default App;
