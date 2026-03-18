import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import App from './App.tsx';
import ProductDetailPage from './pages/ProductDetailPage.tsx';
import ProductListPage from './pages/ProductListPage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/product/:code" element={<ProductDetailPage />} />
        <Route path="/list" element={<ProductListPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
