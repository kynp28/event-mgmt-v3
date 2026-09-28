import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "./pages/Login";
import { AdminDashboard, OrganizerDashboard, VendorDashboard } from "./pages/Dashboards";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/organizer/*" element={<OrganizerDashboard />} />
          <Route path="/vendor/*" element={<VendorDashboard />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
