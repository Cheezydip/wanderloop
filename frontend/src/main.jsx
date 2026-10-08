import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';
import { TripProvider } from './context/TripContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1010952639411-0kchcl41besnve08cblu08abta9upne7.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <ThemeProvider>
          <TripProvider>
            <App />
          </TripProvider>
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
