import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth-context";
import { I18nProvider } from "./lib/i18n";
import { PrintProvider } from "./lib/print";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <PrintProvider>
          <App />
        </PrintProvider>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>,
);
