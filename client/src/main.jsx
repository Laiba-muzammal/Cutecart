import { createRoot } from "react-dom/client";
import React from 'react';
import App from "./App.jsx"; // Imports the fully defined App component
import "./index.css"; // Global styles

const container = document.getElementById("root");

// The rendering call MUST happen AFTER the App component is imported and ready.
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);