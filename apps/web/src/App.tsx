import { BrowserRouter } from "react-router-dom";
import { AppStateProvider } from "./features/app/AppStateContext";
import { AppRoutes } from "./routes/AppRoutes";

export function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppStateProvider>
  );
}
