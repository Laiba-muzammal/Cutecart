import React from 'react';
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const Layout = ({ children, hideNavbar = false, hideFooter = false }) => {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {!hideNavbar && <Navbar />}
      <main className="flex-1 w-full">
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
};

export default Layout;
