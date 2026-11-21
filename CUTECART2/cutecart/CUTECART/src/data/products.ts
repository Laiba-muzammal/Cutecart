import productNotebook from "../assets/product-notebook.jpg";
import productPens from "../assets/product-pens.jpg";
import productStickers from "../assets/product-stickers.jpg";
import productPlanner from "../assets/product-planner.jpg";
import productWashi from "../assets/product-washi.jpg";
import productPencilcase from "../assets/product-pencilcase.jpg";
import { Product, Category } from "../types";

export const products: Product[] = [
  {
    id: "1",
    name: "Sakura Bloom Notebook",
    price: 12.99,
    image: productNotebook,
    category: "Notebooks",
    description: "Beautiful floral notebook with 120 lined pages. Perfect for journaling and note-taking.",
    colors: ["Pink", "White", "Lavender"],
    inStock: true,
    isNew: true,
    isBestseller: true,
  },
  {
    id: "2",
    name: "Bunny Gel Pen Set",
    price: 8.99,
    image: productPens,
    category: "Pens",
    description: "Set of 5 adorable bunny-themed gel pens in pastel colors. Smooth writing experience.",
    colors: ["Pink", "Purple", "Mint", "Coral"],
    inStock: true,
    isBestseller: true,
  },
  {
    id: "3",
    name: "Kawaii Sticker Sheet",
    price: 4.99,
    image: productStickers,
    category: "Stickers",
    description: "Cute sticker sheets featuring hearts, stars, and bunny designs. Perfect for decorating.",
    inStock: true,
    isNew: true,
  },
  {
    id: "4",
    name: "Floral Weekly Planner",
    price: 15.99,
    image: productPlanner,
    category: "Planners",
    description: "Stay organized with this beautiful weekly planner featuring floral designs.",
    colors: ["Pink", "Cream"],
    inStock: true,
    isBestseller: true,
  },
  {
    id: "5",
    name: "Cherry Blossom Washi Tape",
    price: 6.99,
    image: productWashi,
    category: "Washi Tape",
    description: "Set of 4 washi tape rolls in beautiful pastel patterns. Great for crafting.",
    inStock: true,
    isNew: true,
  },
  {
    id: "6",
    name: "Bunny Face Pencil Case",
    price: 9.99,
    image: productPencilcase,
    category: "Accessories",
    description: "Adorable bunny face pencil case with zipper closure. Fits all your stationery essentials.",
    colors: ["Pink", "White"],
    inStock: true,
    isBestseller: true,
  },
  {
    id: "7",
    name: "Pastel Highlighter Set",
    price: 7.99,
    image: productPens,
    category: "Pens",
    description: "Set of 6 pastel highlighters in soft, eye-friendly colors. Perfect for studying.",
    colors: ["Pink", "Yellow", "Blue", "Green", "Purple", "Orange"],
    inStock: true,
  },
  {
    id: "8",
    name: "Heart Sticky Notes",
    price: 3.99,
    image: productStickers,
    category: "Stickers",
    description: "Heart-shaped sticky notes in gradient pink colors. 200 sheets included.",
    inStock: true,
    isNew: true,
  },
];

export const categories: Category[] = [
  { id: "1", name: "Notebooks", icon: "📓", count: 24 },
  { id: "2", name: "Pens", icon: "🖊️", count: 36 },
  { id: "3", name: "Stickers", icon: "⭐", count: 48 },
  { id: "4", name: "Planners", icon: "📅", count: 18 },
  { id: "5", name: "Washi Tape", icon: "🎀", count: 30 },
  { id: "6", name: "Accessories", icon: "💖", count: 22 },
];

export const moodBoards = [
  {
    id: "1",
    theme: "Sakura Dreams",
    color: "Pink",
    productIds: ["1", "2", "5"],
  },
  {
    id: "2",
    theme: "Study Buddy",
    color: "Lavender",
    productIds: ["4", "7", "6"],
  },
  {
    id: "3",
    theme: "Kawaii Vibes",
    color: "Mint",
    productIds: ["3", "2", "8"],
  },
];