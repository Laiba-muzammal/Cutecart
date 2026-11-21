import express from 'express';

const router = express.Router();

// In-memory cart storage (for demo - use database in production)
let carts = {};

// Get cart
router.get('/:userId', (req, res) => {
  const cart = carts[req.params.userId] || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ items: cart, total, count: cart.length });
});

// Add to cart
router.post('/:userId', (req, res) => {
  const { userId } = req.params;
  const { product, quantity = 1 } = req.body;

  if (!carts[userId]) {
    carts[userId] = [];
  }

  const existingItem = carts[userId].find(item => item.id === product.id);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    carts[userId].push({ ...product, quantity });
  }

  const total = carts[userId].reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ 
    message: 'Product added to cart',
    items: carts[userId],
    total,
    count: carts[userId].length 
  });
});

// Update cart item
router.put('/:userId/:productId', (req, res) => {
  const { userId, productId } = req.params;
  const { quantity = 1, product } = req.body;

  // Always ensure the cart exists (even if empty)
  if (!carts[userId]) {
    carts[userId] = [];
  }

  // Find existing item
  const existing = carts[userId].find(item => item.id === productId);

  // If item not found but product payload is provided, add it (makes PUT idempotent-ish for demo)
  if (!existing && product) {
    carts[userId].push({ ...product, quantity });
  } else if (!existing) {
    return res.status(404).json({ error: 'Item not found in cart. Provide `product` in body to add it or POST first.' });
  } else {
    existing.quantity = quantity;
  }

  const total = carts[userId].reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ 
    message: 'Cart updated',
    items: carts[userId],
    total,
    count: carts[userId].length 
  });
});

// Remove from cart
router.delete('/:userId/:productId', (req, res) => {
  const { userId, productId } = req.params;

  if (!carts[userId]) {
    return res.status(404).json({ error: 'Cart not found' });
  }

  carts[userId] = carts[userId].filter(item => item.id !== productId);

  const total = carts[userId].reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ 
    message: 'Item removed from cart',
    items: carts[userId],
    total,
    count: carts[userId].length 
  });
});

// Clear cart
router.delete('/:userId', (req, res) => {
  carts[req.params.userId] = [];
  res.json({ message: 'Cart cleared', items: [], total: 0, count: 0 });
});

export default router;
