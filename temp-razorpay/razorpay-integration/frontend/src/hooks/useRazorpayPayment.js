/**
 * hooks/useRazorpayPayment.js
 *
 * Encapsulates the full client-side checkout flow:
 *   1. load Razorpay script
 *   2. create a Razorpay order on the backend
 *   3. open Checkout with all payment methods enabled
 *   4. on success, verify the signature on the backend
 *   5. on failure/dismiss, report it and surface state to the UI
 *
 * Usage:
 *   const { payNow, status, error } = useRazorpayPayment();
 *   <button onClick={() => payNow(orderId)}>Pay</button>
 */

import { useCallback, useState } from 'react';
import { loadRazorpayScript } from '../utils/loadRazorpayScript';
import { createPaymentOrder, verifyPayment, reportPaymentFailure } from '../services/paymentApi';

export const PAYMENT_STATUS = {
  IDLE: 'IDLE',
  LOADING_SDK: 'LOADING_SDK',
  CREATING_ORDER: 'CREATING_ORDER',
  AWAITING_USER: 'AWAITING_USER', // Razorpay modal is open
  VERIFYING: 'VERIFYING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

export function useRazorpayPayment({ onSuccess, onFailure } = {}) {
  const [status, setStatus] = useState(PAYMENT_STATUS.IDLE);
  const [error, setError] = useState(null);

  const payNow = useCallback(
    async (orderId) => {
      setError(null);

      try {
        setStatus(PAYMENT_STATUS.LOADING_SDK);
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Failed to load Razorpay Checkout. Check your internet connection.');
        }

        setStatus(PAYMENT_STATUS.CREATING_ORDER);
        const orderData = await createPaymentOrder(orderId);

        const options = {
          key: orderData.keyId,
          amount: orderData.amount, // paise
          currency: orderData.currency,
          name: 'Your Store Name',
          description: 'Order Payment',
          order_id: orderData.razorpayOrderId,

          // Leaving `method` unset (or explicitly listing all) lets
          // Razorpay show every method enabled on your account: UPI,
          // cards, netbanking, wallets, EMI, pay-later, etc. You
          // rarely need to restrict this — Razorpay's checkout
          // already surfaces all eligible methods automatically.
          prefill: {
            name: orderData.prefill?.name,
            email: orderData.prefill?.email,
            contact: orderData.prefill?.contact,
          },
          notes: {
            orderId: orderData.orderId,
          },
          theme: { color: '#3399cc' },

          handler: async function handleSuccess(response) {
            try {
              setStatus(PAYMENT_STATUS.VERIFYING);
              const result = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: orderData.orderId,
              });

              setStatus(PAYMENT_STATUS.SUCCESS);
              onSuccess?.(result.data);
            } catch (verifyErr) {
              setStatus(PAYMENT_STATUS.FAILED);
              const message =
                verifyErr.response?.data?.message || 'Payment verification failed. Please contact support.';
              setError(message);
              onFailure?.({ message });
            }
          },

          modal: {
            ondismiss: async function handleDismiss() {
              // User closed the checkout modal without completing payment.
              setStatus(PAYMENT_STATUS.CANCELLED);
              try {
                await reportPaymentFailure({
                  razorpay_order_id: orderData.razorpayOrderId,
                  orderId: orderData.orderId,
                  error: { reason: 'checkout_dismissed_by_user' },
                });
              } catch (_) {
                // best-effort; webhook remains the backstop
              }
            },
          },
        };

        const razorpayInstance = new window.Razorpay(options);

        razorpayInstance.on('payment.failed', async function handleFailed(response) {
          setStatus(PAYMENT_STATUS.FAILED);
          const message = response.error?.description || 'Payment failed.';
          setError(message);

          try {
            await reportPaymentFailure({
              razorpay_order_id: response.error?.metadata?.order_id || orderData.razorpayOrderId,
              orderId: orderData.orderId,
              error: response.error,
            });
          } catch (_) {
            // best-effort; webhook remains the backstop
          }

          onFailure?.({ message, raw: response.error });
        });

        setStatus(PAYMENT_STATUS.AWAITING_USER);
        razorpayInstance.open();
      } catch (err) {
        setStatus(PAYMENT_STATUS.FAILED);
        const message = err.response?.data?.message || err.message || 'Something went wrong.';
        setError(message);
        onFailure?.({ message });
      }
    },
    [onSuccess, onFailure]
  );

  return { payNow, status, error };
}
