import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { HeroSection } from "../components/HeroSection";
import { ProductCard } from "../components/ProductCard";
import { CategoryCard } from "../components/CategoryCard";
import { products, categories } from "../data/products";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Heart, Truck, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const featuredProducts = products.filter((p) => p.isBestseller).slice(0, 4);
  const newProducts = products.filter((p) => p.isNew).slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <HeroSection />

        {/* Categories Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-3xl font-bold mb-2">
                Shop by <span className="text-gradient">Category</span>
              </h2>
              <p className="text-muted-foreground">
                Find exactly what you're looking for
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category, index) => (
                <CategoryCard key={category.id} category={category} index={index} />
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 px-4 bg-secondary/30">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-between items-center mb-10"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  <span className="text-gradient">Bestsellers</span> 💖
                </h2>
                <p className="text-muted-foreground">
                  Our most loved stationery items
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/shop?filter=bestseller">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          </div>
        </section>

        {/* New Arrivals */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-between items-center mb-10"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  New <span className="text-gradient">Arrivals</span> ✨
                </h2>
                <p className="text-muted-foreground">
                  Fresh stationery just for you
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/shop?filter=new">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {newProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          </div>
        </section>

        {/* Features Banner */}
        <section className="py-16 px-4 gradient-hero">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center text-center gap-4 p-6"
              >
                <div className="p-4 rounded-full bg-card shadow-soft">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Free Shipping</h3>
                <p className="text-sm text-muted-foreground">
                  Free shipping on orders over $50
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center text-center gap-4 p-6"
              >
                <div className="p-4 rounded-full bg-card shadow-soft">
                  <RefreshCw className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Easy Returns</h3>
                <p className="text-sm text-muted-foreground">
                  30-day hassle-free return policy
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center text-center gap-4 p-6"
              >
                <div className="p-4 rounded-full bg-card shadow-soft">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Made with Love</h3>
                <p className="text-sm text-muted-foreground">
                  Curated with care for stationery lovers
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl bg-card shadow-glow overflow-hidden p-8 md:p-12 text-center"
            >
              <div className="absolute top-4 left-4 text-4xl opacity-30">🎀</div>
              <div className="absolute bottom-4 right-4 text-4xl opacity-30">✨</div>
              
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Create Your <span className="text-gradient">Dream</span> Notebook
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8">
                Design your own personalized notebook with custom covers, colors,
                and add your name or favorite quote!
              </p>
              <Button variant="hero" size="xl" asChild>
                <Link to="/customize">
                  Start Customizing
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
