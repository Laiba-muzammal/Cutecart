import { Product } from "../lib/types"; // Up to src/, down to lib/
import { Button } from "./ui/button";
import { Heart, ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext"; // Up to src/, down to context/
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { addToCart, addToWishlist, isInWishlist, isInCart } = useCart();
  const inWishlist = isInWishlist(product.id);
  const inCart = isInCart(product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group relative rounded-2xl bg-card shadow-card overflow-hidden hover:shadow-glow transition-all duration-300"
    >
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {product.isNew && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-accent text-accent-foreground">
            New
          </span>
        )}
        {product.isBestseller && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
            Bestseller
          </span>
        )}
      </div>

      {/* Wishlist button */}
      <button
        onClick={() => addToWishlist(product)}
        className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-300 ${
          inWishlist
            ? "bg-primary text-primary-foreground"
            : "bg-card/80 backdrop-blur text-foreground hover:bg-primary hover:text-primary-foreground"
        }`}
      >
        <Heart className={`h-4 w-4 ${inWishlist ? "fill-current" : ""}`} />
      </button>

      {/* Image */}
      <Link to={`/product/${product.id}`}>
        <div className="aspect-square overflow-hidden bg-secondary/50">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{product.category}</p>
          <Link to={`/product/${product.id}`}>
            <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            ${product.price.toFixed(2)}
          </span>
          <Button
            variant={inCart ? "secondary" : "cart"}
            size="icon"
            onClick={() => addToCart(product)}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
