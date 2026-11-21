# CuteCart Backend API 🎀

Node.js/Express REST API for CuteCart e-commerce application.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start the server:
```bash
npm run dev
```

Server runs on: `http://localhost:5000`

## API Endpoints

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get single product
- `GET /api/products/categories/all` - Get all categories

### Cart
- `GET /api/cart/:userId` - Get user's cart
- `POST /api/cart/:userId` - Add item to cart
- `PUT /api/cart/:userId/:productId` - Update cart item
- `DELETE /api/cart/:userId/:productId` - Remove from cart
- `DELETE /api/cart/:userId` - Clear cart

### Orders
- `GET /api/orders/:userId` - Get user's orders
- `GET /api/orders/:userId/:orderId` - Get single order
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:orderId/status` - Update order status

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

## Test in Postman

Import this base URL: `http://localhost:5000/api`

### Example Requests:

**Get all products:**
```
GET http://localhost:5000/api/products
```

**Add to cart:**
```
POST http://localhost:5000/api/cart/user123
Body: {
  "product": { "id": "1", "name": "Sakura Notebook", "price": 12.99 },
  "quantity": 1
}
```

**Login:**
```
POST http://localhost:5000/api/auth/login
Body: {
  "email": "demo@cutecart.com",
  "password": "demo123"
}
```
