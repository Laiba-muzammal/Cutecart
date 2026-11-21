import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { products, moodBoards } from "@/data/products";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

const MoodBoard = () => {
  const { addToCart } = useCart();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-2">Stationery <span className="text-gradient">Mood Board</span> 🎨</h1>
            <p className="text-muted-foreground">Get matching sets for a complete aesthetic collection</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
  {moodBoards.map((board, idx) => {
    // Mood board ke products find karo
    const boardProducts = board.productIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean); // null/undefined remove

    // Total price calculate karo
    const total = boardProducts.reduce((sum, p) => sum + p.price, 0);
              return (
                <motion.div key={board.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="rounded-2xl bg-card shadow-card p-6">
                  <h3 className="font-bold text-lg mb-1">{board.theme}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{board.color} collection</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {boardProducts.map((p) => (<img key={p.id} src={p.image} alt={p.name} className="w-full aspect-square rounded-lg object-cover" />))}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-primary">${total.toFixed(2)}</span>
                    <Button size="sm" onClick={() => boardProducts.forEach((p) => addToCart(p))}><ShoppingCart className="h-4 w-4 mr-1" /> Add Set</Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MoodBoard;
