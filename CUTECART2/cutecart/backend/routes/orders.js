import express from 'express';

const router = express.Router();

// In-memory orders storage (use database in production)
let orders = [];
let orderIdCounter = 1;

// Get all orders for a user
router.get('/:userId', (req, res) => {
  const userOrders = orders.filter(order => order.userId === req.params.userId);
  res.json(userOrders);
});

// Get single order
router.get('/:userId/:orderId', (req, res) => {
  const order = orders.find(
    o => o.id === req.params.orderId && o.userId === req.params.userId
  );
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json(order);
});

// Create order
router.post('/', (req, res) => {
  const { userId, items, total, shippingAddress, paymentMethod } = req.body;

  const order = {
    id: `ORDER-${orderIdCounter++}`,
    userId,
    items,
    total,
    shippingAddress,
    paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  orders.push(order);

  res.status(201).json({
    message: 'Order created successfully! 🎀',
    order
  });
});

// Update order status
router.patch('/:orderId/status', (req, res) => {
  const { status } = req.body;
  const order = orders.find(o => o.id === req.params.orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  res.json({
    message: 'Order status updated',
    order
  });
});

export default router;
