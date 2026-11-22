import React from 'react';
// Imports for global dependencies
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// Imports for your custom contexts
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";

// Imports for all your page components
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import Categories from "./pages/Categories";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Customize from "./pages/Customize";
import MoodBoard from "./pages/MoodBoard";
import NotFound from "./pages/NotFound";

// 1. Initialize global clients
const queryClient = new QueryClient();

// 2. Define the App Component (The Root of your UI)
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Context Providers must wrap the entire router/routes */}
      <AuthProvider>
        <CartProvider>
          {/* Toaster goes here for global access */}
          <Toaster position="top-center" richColors />
          
          <BrowserRouter>
            <Routes>
              {/* Define all your routes */}
              <Route path="/" element={<Index />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/customize" element={<Customize />} />
              <Route path="/mood-board" element={<MoodBoard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

// 3. Export the App component
export default App;