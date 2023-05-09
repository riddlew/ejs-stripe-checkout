require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_API_KEY);
// https://dashboard.stripe.com/test/webhooks/create?endpoint_location=local
const endpointSecret = process.env.STRIPE_WEBHOOK_ENDPOINT_KEY;
const express = require('express');
const ejs = require('ejs');
const app = express();
const port = 8000;

app.set('view engine', 'html');
app.engine('html', ejs.renderFile);

app.use(express.static('public'));

///////////////////////////////////////////////////////////////////////////////
// Products available for sale (loads from stripe on server startup).
///////////////////////////////////////////////////////////////////////////////
const products = [];

///////////////////////////////////////////////////////////////////////////////
// User Cart
///////////////////////////////////////////////////////////////////////////////
const userCart = [];

///////////////////////////////////////////////////////////////////////////////
// Helper Functions
///////////////////////////////////////////////////////////////////////////////
async function getProducts() {
	// You can't get products with prices, instead you have to get prices
	// with products???
	// const prices = await stripe.prices.list({
	// 	expand: ['data.product'],
	// });
	// const json = await prices.json();
	const products = await stripe.products.list({
		expand: ['data.default_price'],
	});
	return products.data;
}

function getNumUserItems() {
	if (userCart.length === 0) return 0;
	return userCart.reduce((acc, cur) => acc + cur.quantity, 0);
}

async function fulfillOrder(session) {
	const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
		session.id, {
			expand: ['line_items'],
		}
	);
	const lineItems = sessionWithLineItems.line_items;
	console.log("/////////////////////////////////////////////////////")
	console.log("// Fulfill Order                                   //");
	console.log("/////////////////////////////////////////////////////")
	console.log(lineItems);
	console.log('\r\n');
}

async function createOrder(session) {
	console.log("/////////////////////////////////////////////////////")
	console.log("// Create Order                                    //");
	console.log("/////////////////////////////////////////////////////")
	console.log('\r\n');
}

async function sendFailedPaymentEmail(session) {
	console.log("/////////////////////////////////////////////////////")
	console.log("// FAILED PAYMENT - Email Customer                 //");
	console.log("/////////////////////////////////////////////////////")
	console.log('\r\n');
}

///////////////////////////////////////////////////////////////////////////////
// Routes
///////////////////////////////////////////////////////////////////////////////
app.get('/', async (req, res) => {
	res.render('home.ejs', { products, numCartItems: getNumUserItems() });
});

// User checkout page
app.get('/checkout', (req, res) => {
	res.render('checkout.ejs', { userCart, numCartItems: getNumUserItems() });
})

// API call to add an item to cart
app.get('/api/add/:id', (req, res) => {
	// check if user already has one in cart.
	const cartIndex = userCart.findIndex(
		item => item.id === req.params.id
	);

	// user has item in cart already, increase qty.
	if (cartIndex > -1) {
		userCart[cartIndex].quantity++;
		return res.json({
			code: 300,
			message: 'Item added to cart',
		})
	}

	// user does not have this item in their cart yet.
	const item = products.find(item => item.id === req.params.id);
	if (item) {
		userCart.push({ ...item, quantity: 1});
		return res.json({
			code: 300,
			message: 'Item added to cart',
		})
	}

	// invalid ID.
	return res.json({
		code: 404,
		message: 'Incorrect item ID',
	})
})

// POST request to start Stripe checkout.
app.post('/stripe-checkout', async(req, res) => {
	const session = await stripe.checkout.sessions.create({
		line_items: [
			...userCart.map(item => {
				return {
					price: item.default_price.id,
					quantity: item.quantity
				}
			})
		],
		// One-time payment, not recurring.
		mode: 'payment',
		// URL customer redirects to upon successful payment.
		success_url: 'http://localhost:8000/payment_success',
		// URL customer redirects to when they cancel checkout.
		cancel_url: 'http://localhost:8000/',
	});

	// Go to stripe
	res.redirect(303, session.url);
});

// Page customer will see after paying.
app.get('/payment_success', async(req, res) => {
	userCart.length = 0;
	return res.render('payment_success.ejs');
})

// Webhook that's called after customer payment.
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
	const payload = req.body;
	const sig = req.headers['stripe-signature'];

	// Verify the call was from Stripe usign the endpoint secret API key.
	let event;
	try {
		event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
	} catch (err) {
		console.error(err);
		res.status(400).send(`Webhook Error: ${err.message}`);
		return;
	}

	// Handle all payment events.
	switch (event.type) {
		// Checkout has been successfully completed.
		case 'checkout.session.completed': {
			console.log("/////////////////////////////////////////////////////")
			console.log("// Event: checkout.session.completed               //");
			console.log("/////////////////////////////////////////////////////")
			console.log('\r\n');

			const session = event.data.object;

			// Create an order in the database that is marked as waiting for payment,
			// since the payment may be delayed due to various factors.
			createOrder(session);

			// If the order is paid, fulfill it. If it's pending, don't.
			if (session.payment_status === 'paid') {
				fulfillOrder(session);
			}
			break;
		}

		// A delayed payment has finally succeeded.
		case 'checkout.session.async_payment_succeeded': {
			console.log("/////////////////////////////////////////////////////")
			console.log("// Event: checkout.session.async_payment_succeeded //");
			console.log("/////////////////////////////////////////////////////")
			console.log('\r\n');

			const session = event.data.object;
			fulfillOrder(session);
			break;
		}

		// A delayed payment has failed.
		case 'checkout.session.async_payment_failed': {
			console.log("/////////////////////////////////////////////////////")
			console.log("// Event: checkout.session.async_payment_failed    //");
			console.log("/////////////////////////////////////////////////////")
			console.log('\r\n');

			const session = event.data.object;
			sendFailedPaymentEmail(session);
			break;;
		}

		default: {
			console.log("/////////////////////////////////////////////////////")
			console.log("// Unhandled Event                                 //");
			console.log("/////////////////////////////////////////////////////")
			console.log(`${event.type}\r\n`);
		}
	}

	res.status(200).send();
})

// Run server.
app.listen(port, () => {
	// Load products from stripe.
	getProducts().then(items => products.push(...items));

	console.log("app running on " + port);
});