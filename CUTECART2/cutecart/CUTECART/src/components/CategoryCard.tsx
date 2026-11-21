import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Category } from "../../../src/lib/types";

interface CategoryCardProps {
  category: Category;
  index?: number;
}

export function CategoryCard({ category, index = 0 }: CategoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      <Link
        to={`/shop?category=${category.name}`}
        className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card shadow-card hover:shadow-glow transition-all duration-300 hover:-translate-y-1"
      >
        <span className="text-4xl group-hover:animate-wiggle">{category.icon}</span>
        <h3 className="font-semibold text-foreground">{category.name}</h3>
        <span className="text-xs text-muted-foreground">{category.count} items</span>
      </Link>
    </motion.div>
  );
}
