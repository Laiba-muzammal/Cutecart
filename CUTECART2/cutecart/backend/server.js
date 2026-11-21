import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import ordersRouter from './routes/orders.js';
import authRouter from './routes/auth.js';
import verifyJWT from './middleware/user.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB (Mongoose) connection — merged from your snippet
const MONGO_URI =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/auth_welab';

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, {
      // If connecting to a standalone connection string without db name
      dbName: process.env.MONGODB_DB || 'auth_welab',
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}
connectMongo();

const db = mongoose.connection;
db.on('error', (err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CuteCart API is running! 🎀' });
});

// Root route (from your snippet)
app.get('/', (req, res) => {
  res.send('Hello World');
});

// Example protected route
app.get('/protected', verifyJWT, (req, res) => {
  res.send(`This is a Protected Route. Welcome ${req.user.username}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`🎀 CuteCart API running on http://localhost:${PORT}`);
});
