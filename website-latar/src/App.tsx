import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CompanyProfile from './pages/CompanyProfile';
import FullMenuPage from './pages/FullMenuPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/tentang-kami" element={<CompanyProfile />} />
        <Route path="/menu" element={<FullMenuPage />} />
      </Routes>
    </BrowserRouter>
  );
}
