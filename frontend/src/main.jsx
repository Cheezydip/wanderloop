import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { TripProvider } from './context/TripContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <TripProvider>
          <App />
        </TripProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
