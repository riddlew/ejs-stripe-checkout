# ejs-stripe-checkout
Example EJS app on how to integrate with Stripe API.

## Instructions
Before running the app, you will have to add some products to your Stripe account if you haven't already. When the app starts, it will load the products that are on your Stripe account.

1. `npm install` to install dependencies.
2. Create `.env` file and add `STRIPE_API_KEY` and `STRIPE_WEBHOOK_ENDPOINT_KEY` (you can find the webhook endpoint key in the code at the URL https://dashboard.stripe.com/test/webhooks/create?endpoint_location=local).
3. Install the Stripe CLI and run `stripe listen --forward-to localhost:8000/webhook`.
4. `npm run start`.
5. App is now running at `localhost:8000`.
