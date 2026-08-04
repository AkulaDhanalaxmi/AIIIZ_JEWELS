# Aiiz Backend API

A real, runnable Node.js + Express + MongoDB backend for the Aiiz jewelry app.

## Setup

```bash
cd aiiz-backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — a local MongoDB (`mongodb://localhost:27017/aiiz`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) connection string
- `JWT_SECRET` — any long random string

Seed sample data (5 categories, 5 products, and an admin login):

```bash
npm run seed
```

This creates the admin login: **admin@aiiz.com / aiiz123**

Start the server:

```bash
npm run dev     # with auto-reload (nodemon)
# or
npm start
```

Server runs at `http://localhost:5000`. Check it's alive: `GET http://localhost:5000/api/health`

## Project structure

```
config/       db.js (Mongo connection), seed.js (sample data)
models/       User, Category, Product, Cart, Order (Mongoose schemas)
controllers/  business logic for each resource
routes/       Express routers, wired to controllers
middleware/   auth.js (JWT), errorHandler.js
server.js     app entry point
```

## API Reference

All request/response bodies are JSON. Protected routes need:
`Authorization: Bearer <token>` (token returned from register/login).

### Auth
| Method | Route | Auth | Body |
|---|---|---|---|
| POST | /api/auth/register | — | `{ name, email, password, phone }` |
| POST | /api/auth/login | — | `{ email, password }` |
| GET | /api/auth/me | user | — |

### Categories
| Method | Route | Auth | Body |
|---|---|---|---|
| GET | /api/categories | — | — |
| GET | /api/categories/:id | — | — |
| POST | /api/categories | admin | `{ name, icon }` |
| PUT | /api/categories/:id | admin | `{ name, icon }` |
| DELETE | /api/categories/:id | admin | — |

### Products
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | /api/products | — | Query: `category, search, minPrice, maxPrice, featured, page, limit` |
| GET | /api/products/:id | — | — |
| POST | /api/products | admin | `{ name, category, price, mrp, material, occasion, weight, description, stock }` |
| PUT | /api/products/:id | admin | same fields, partial |
| DELETE | /api/products/:id | admin | — |

### Cart (per logged-in user)
| Method | Route | Auth | Body |
|---|---|---|---|
| GET | /api/cart | user | — |
| POST | /api/cart | user | `{ productId, qty }` |
| PUT | /api/cart/:productId | user | `{ qty }` (0 removes item) |
| DELETE | /api/cart/:productId | user | — |

### Wishlist
| Method | Route | Auth |
|---|---|---|
| GET | /api/wishlist | user |
| POST | /api/wishlist/:productId | user |
| DELETE | /api/wishlist/:productId | user |

### Orders
| Method | Route | Auth | Body |
|---|---|---|---|
| POST | /api/orders | user | `{ address, paymentMethod, items? }` — omit `items` to checkout from the cart |
| GET | /api/orders | user | your order history |
| GET | /api/orders/:id | user/admin | single order (for tracking) |
| GET | /api/orders/admin/all | admin | every order |
| PUT | /api/orders/:id/status | admin | `{ status }` — confirmed → packed → shipped → delivered |

## Example: full checkout flow

```bash
# 1. Register / login → get a token
curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@aiiz.com","password":"aiiz123"}'

# 2. Browse products
curl localhost:5000/api/products?category=<categoryId>

# 3. Add to cart
curl -X POST localhost:5000/api/cart -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"productId":"<id>","qty":1}'

# 4. Place order
curl -X POST localhost:5000/api/orders -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"address":{"name":"Aanya","phone":"9876543210","line":"..."},"paymentMethod":"upi"}'

# 5. Track it
curl localhost:5000/api/orders/<orderId> -H "Authorization: Bearer <token>"
```

## Connecting the frontend

The `aiiz-jewelry-app.html` and `admin.html` prototypes currently use in-browser storage
as a stand-in database. To wire them to this real backend, replace the `DB` object and
`window.storage` calls with `fetch()` calls to these endpoints (e.g.
`fetch('http://localhost:5000/api/products')`), and store the JWT token after login to
send on every request.

## Deploying

- **Database**: MongoDB Atlas (free tier) — get a `MONGO_URI` from the Atlas dashboard.
- **Server**: Render, Railway, or Fly.io all support Node apps directly from a GitHub repo.
  Set the same environment variables from `.env` in your host's dashboard.
- Set `CLIENT_URL` to your deployed frontend's URL for CORS once you host it.
