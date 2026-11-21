export const products = [
  {
    id: "1",
    name: "Sakura Bloom Notebook",
    price: 12.99,
    image: "/assets/product-notebook.jpg",
    category: "Notebooks",
    description: "Beautiful floral notebook with 120 lined pages. Perfect for journaling and note-taking.",
    colors: ["Pink", "White", "Lavender"],
    inStock: true,
    isNew: true,
    isBestseller: true,
    stock: 50
  },
  {
    id: "2",
    name: "Bunny Gel Pen Set",
    price: 8.99,
    image: "/assets/product-pens.jpg",
    category: "Pens",
    description: "Set of 6 colorful gel pens with cute bunny toppers.",
    colors: ["Assorted"],
    inStock: true,
    isNew: false,
    isBestseller: true,
    stock: 100
  },
  {
    id: "3",
    name: "Kawaii Sticker Pack",
    price: 6.99,
    image: "/assets/product-stickers.jpg",
    category: "Stickers",
    description: "100+ adorable stickers featuring cute animals and food.",
    colors: ["Multi"],
    inStock: true,
    isNew: true,
    isBestseller: false,
    stock: 200
  },
  {
    id: "4",
    name: "Pastel Washi Tape Set",
    price: 9.99,
    image: "/assets/product-washi.jpg",
    category: "Washi Tape",
    description: "Set of 10 pastel washi tapes in various patterns.",
    colors: ["Pastel Mix"],
    inStock: true,
    isNew: false,
    isBestseller: true,
    stock: 75
  },
  {
    id: "5",
    name: "Cloud Pencil Case",
    price: 14.99,
    image: "/assets/product-pencilcase.jpg",
    category: "Pencil Cases",
    description: "Fluffy cloud-shaped pencil case with zipper.",
    colors: ["White", "Blue", "Pink"],
    inStock: true,
    isNew: true,
    isBestseller: false,
    stock: 40
  },
  {
    id: "6",
    name: "Monthly Planner",
    price: 16.99,
    image: "/assets/product-planner.jpg",
    category: "Planners",
    description: "12-month planner with cute illustrations and stickers.",
    colors: ["Pink", "Blue"],
    inStock: true,
    isNew: false,
    isBestseller: true,
    stock: 30
  }
];

export const categories = [
  { id: "1", name: "Notebooks", icon: "📓", count: 45 },
  { id: "2", name: "Pens", icon: "🖊️", count: 67 },
  { id: "3", name: "Stickers", icon: "✨", count: 120 },
  { id: "4", name: "Washi Tape", icon: "🎀", count: 38 },
  { id: "5", name: "Pencil Cases", icon: "📦", count: 25 },
  { id: "6", name: "Planners", icon: "📅", count: 19 }
];
