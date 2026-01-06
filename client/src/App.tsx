import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';

function App() {
  return (
    <div className="h-full flex flex-col bg-steam-bg">
      <Routes>
        <Route path="/" element={<LibraryPage />} />
      </Routes>
    </div>
  );
}

export default App;
