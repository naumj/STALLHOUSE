# Stallhouse: shop website with admin

No installs needed. You only need Node 18 or newer (https://nodejs.org).

## Run it

    node server.js

- Shop:  http://localhost:3000
- Admin: http://localhost:3000/admin

On the first run the terminal prints your admin password. It is shown once.
Sign in, then change it under Shop info > Admin password.
To choose the first password yourself, start with:  ADMIN_PASSWORD="your-long-password" node server.js

## What is connected

- Products, prices and stock you change in the admin show on the shop right away.
- Orders placed on the shop appear in Admin > Orders, and stock goes down automatically.
- The server recalculates every order total from its own prices. Nothing the browser sends can change a price.
- Customers pay on delivery (cash or M-Pesa). There is no online card payment.

## Putting it online

1. Use a host that runs Node (a small VPS, Render, Railway, Fly.io and similar).
2. Serve it over HTTPS (most hosts do this for you). Behind a proxy, also set TRUST_PROXY=1.
3. Keep the `data` folder on a persistent disk. It holds your products, orders and password hash.
   Back it up. Set DATA_DIR=/path to move it.
4. Optional: PORT, HOST, COOKIE_SECURE=1.

## Security built in

Password stored as a scrypt hash, login limited to 5 wrong tries per 15 minutes, sessions in an
HttpOnly SameSite=Strict cookie, all input checked on the server, strict Content-Security-Policy,
and no dependencies to keep patched. Pick a long unique password and keep Node up to date.

## Sample data

The first run fills the shop with 24 sample products marked "Sample". Admin > Products > Remove sample items clears them.
Prices are in USD until you change the currency under Shop info.
