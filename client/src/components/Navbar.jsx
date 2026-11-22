import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/shop", label: "Shop" },
    { path: "/categories", label: "Categories" },
    { path: "/mood-board", label: "Mood Board" },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-border shadow-soft">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity">
          <span className="text-2xl">🎀</span>
          <span className="text-gradient">CuteCart</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="px-4 py-2 text-foreground/70 hover:text-foreground hover:bg-secondary/50 rounded-lg transition-all"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <Link to="/wishlist">
            <Button variant="ghost" size="sm" className="hover:bg-secondary/50">
              <Heart className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/cart">
            <Button variant="ghost" size="sm" className="hover:bg-secondary/50">
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/login" className="hidden sm:block">
            <Button variant="outline" size="sm" className="border-2">
              Login
            </Button>
          </Link>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden border-t border-border bg-background"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="px-4 py-2 text-foreground/70 hover:text-foreground hover:bg-secondary/50 rounded-lg transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link to="/login" className="px-4 py-2 border-t border-border mt-2 pt-4">
                <Button variant="outline" className="w-full border-2">
                  Login
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
