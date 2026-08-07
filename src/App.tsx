import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { getCurrentUserId, isAdminLoggedIn, getAppSettings, applyAppTheme } from "@/lib/storage";

import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Invest from "./pages/Invest";
import Withdraw from "./pages/Withdraw";
import Wallet from "./pages/Wallet";
import Deposit from "./pages/Deposit";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import AllInvestments from "./pages/AllInvestments";
import Claim from "./pages/Claim";
import Reinvest from "./pages/Reinvest";
import NotFound from "./pages/NotFound";
import Support from "./pages/Support";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const uid = getCurrentUserId();
  if (!uid) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!isAdminLoggedIn()) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoot() {
  useEffect(() => {
    // Apply saved theme on startup
    getAppSettings().then(s => applyAppTheme(s));
  }, []);

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/invest" element={<ProtectedRoute><Invest /></ProtectedRoute>} />
      <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/deposit" element={<ProtectedRoute><Deposit /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/investments" element={<ProtectedRoute><AllInvestments /></ProtectedRoute>} />
      <Route path="/claim/:id" element={<ProtectedRoute><Claim /></ProtectedRoute>} />
      <Route path="/reinvest/:id" element={<ProtectedRoute><Reinvest /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      <Route path="/support" element={<Support />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
