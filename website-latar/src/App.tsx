import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CompanyProfile from './pages/CompanyProfile';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/tentang-kami" element={<CompanyProfile />} />
      </Routes>
    </BrowserRouter>
  );
}
