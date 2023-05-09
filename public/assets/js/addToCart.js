const addToCartBtns = document.querySelectorAll('.btn-add-to-cart');
const cartNumber = document.querySelector('.header-checkout');

console.log(cartNumber);

addToCartBtns.forEach(btn => {
	const productId = btn.dataset.productId;

	btn.addEventListener('click', () => {
		fetch(`api/add/${productId}`)
			.then(res => res.json())
			.then(res => {
				if (res.status === 404) {
					console.error(res.message);
				} else {
					console.log(res);
					cartNumber.dataset.numItems++;

					// do a little animation to show something was added to the cart.
					cartNumber.classList.add('pulse-number');
					setTimeout(() => {
						cartNumber.classList.remove('pulse-number');
					}, 500);
				}
			})
	});
})
