import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CategoryCard } from "@/components/CategoryCard";
import { categories } from "@/data/products";
import { motion } from "framer-motion";

const Categories = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold mb-2">
              Browse <span className="text-gradient">Categories</span> 🎀
            </h1>
            <p className="text-muted-foreground">
              Find the perfect stationery for every need
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {categories.map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Categories;
