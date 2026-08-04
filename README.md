# Aiiz Jewelry — Full Stack App

This package contains the complete Aiiz jewelry application:

```
aiiz-fullstack/
├── backend/          Node.js + Express + MongoDB API
├── frontend/          Customer-facing storefront (index.html)
└── admin-panel/        Admin dashboard (index.html)
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — local MongoDB (`mongodb://localhost:27017/aiiz`) or a free MongoDB Atlas connection string
- `JWT_SECRET` — any long random string

Seed sample data (categories, products, and an admin login):

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

The API will run at `http://localhost:5000` (or the port set in `.env`).

## 2. Frontend (storefront)

`frontend/index.html` is a static single-file app. Open it directly in a browser, or serve it:

```bash
cd frontend
npx serve .
```

Make sure any API base URL inside the file points at your running backend (e.g. `http://localhost:5000`).

### Login / Sign up flow

The storefront now opens on a **landing page** (no login required). From there:
- **"Explore Collection"** goes straight to the product catalogue — browsing categories, products, and product details never requires an account.
- **"Sign In"** (top right) opens the sign-in screen, which can toggle to "Create Account".
- Actions that need an account — wishlist, cart, checkout, and the profile tab — automatically send a guest to the sign-in screen; after they log in or register, the app resumes the action they were trying to do.
- Sign-in/sign-up call the real backend (`POST /api/auth/login`, `POST /api/auth/register`) and store the returned JWT; the session is re-validated against `GET /api/auth/me` on reload.
- **Logout** (in Profile) clears the session and returns to the landing page.

By default the frontend calls the backend at `http://localhost:5000/api`. To point it at a different backend (e.g. a deployed API), open `frontend/index.html` and set `window.AIIZ_API_BASE = 'https://your-api.example.com/api';` in a small `<script>` tag before the main app script, or edit the `API_BASE` constant directly near the top of the `<script>` block.

The "Continue with Google" button is present in the UI but is a placeholder — wiring it up requires configuring Google OAuth client credentials in the backend, which isn't included yet.

## 3. Admin panel

`admin-panel/index.html` is the admin dashboard, also a static single-file app. Serve it the same way:

```bash
cd admin-panel
npx serve .
```

Log in with the seeded admin credentials above, and point it at the same backend API URL.

## Notes

- Backend, frontend, and admin panel are independent — run the backend first, then open the two HTML files in a browser (or serve them) pointing at the backend's URL.
- See `backend/README.md` for further API details.
