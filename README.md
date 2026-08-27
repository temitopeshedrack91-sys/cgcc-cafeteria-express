# CGCC Express Order

Build a modern mobile-first web application called "CGCC Cafeteria Express".

Tagline:
Order Ahead. Skip the Queue. Pick Up with Ease.

This application is for the Citadel Global Community Church (CGCC) Cafeteria.

The purpose is to reduce long queues by allowing church members to browse the menu, place orders before arriving, make payment via bank transfer, and pick up their meals quickly.

This is NOT a restaurant POS.

It is a pre-order application.

Use a clean, premium, modern interface.

Use the uploaded CGCC logo and derive the application's colours from it.

The application must feel simple, elegant, fast and trustworthy.

Build the following pages.

1. Landing Page

Display:

CGCC Logo

CGCC Cafeteria Express

Tagline

Large "Order Food" button

A short "How It Works" section explaining:

Choose your food

Make payment

Receive Order Code

Pick up your meal

Display menu categories as beautiful cards.

2. Menu Page

Create categories:

Meals

Proteins

Soups & Sides

Snacks & Pastries

Sandwiches

Small Chops

Desserts & Yogurt

Coffee & Tea

Drinks

Water

Extras

Each menu item should show:

Image placeholder

Food name

Price

Quantity selector

Add to Cart button

Use the menu data I will provide in the project.

3. Shopping Cart

Display

Items

Quantity

Subtotal

Grand Total

Checkout button

4. Checkout

Collect:

Customer Name

Phone Number

Optional Note

Example:
"No pepper"

Ask for Order Type:

• Dine-in

• Takeaway

If the customer selects Takeaway and there is no Takeaway Pack in the cart, politely suggest adding a Takeaway Pack before continuing.

5. Payment Page

Display these payment details.

Bank

OPay

Account Name

Olunike Olajumoke Adewumi

Account Number

6104885281

Place a Copy icon beside the account number.

After copying, show:

"Account Number Copied Successfully."

Display a checkbox:

"I have completed payment."

Display a button:

Confirm Payment

Do not integrate any payment gateway yet.

6. Receipt Page

Generate a beautiful receipt.

Display:

CGCC Logo

Receipt Number

Order Code

Customer Name

Items

Prices

Total

Payment Status

Pickup Status

Buttons

Download Receipt

Send Receipt to WhatsApp

The Order Code format should be:

CG-001

CG-002

CG-003

etc.

7. WhatsApp

Business Number

09134749319

When the customer clicks "Send Receipt to WhatsApp", automatically prepare this message:

Hello CGCC Cafeteria,

My name is [Customer Name].

I have completed payment for Order Code [CG-001].

Kindly prepare my order.

Thank you.

8. Admin Area

Create a protected route:

/admin

Create a professional Admin Login page.

Default credentials:

Email

admin@cgcccafeteria.local

Password

CGCC@2026!

After login show a modern dashboard.

Dashboard should contain:

Today's Orders

Pending

Preparing

Ready

Collected

Today's Revenue

Recent Orders

Each order card should display:

Order Code

Customer Name

Phone Number

Items

Amount

Status

Buttons:

Preparing

Ready

Collected

Include search by:

Order Code

Customer Name

Phone Number

9. Admin Controls

Create a Menu Management page.

Each menu item can be marked:

Available

Sold Out

Sold Out items cannot be ordered.

Create another control:

Ordering Open

Ordering Closed

If Ordering Closed is selected, customers should see:

"Online ordering is currently unavailable. Please visit the cafeteria directly."

Build the project using reusable components and prepare it for future Supabase integration without connecting any backend yet.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cgcc-cafeteria-express.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e0ccdef2-07e8-414f-b931-5b46572e5de3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
