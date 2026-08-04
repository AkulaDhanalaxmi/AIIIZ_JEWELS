/**
 * utils/loadRazorpayScript.js
 *
 * Loads the official Razorpay Checkout script once and caches the
 * promise, so multiple checkout attempts on the same page don't
 * inject the <script> tag repeatedly.
 */

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loadPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null; // allow retry on next call
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
