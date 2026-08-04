/**
 * components/Checkout/RazorpayCheckout.jsx
 *
 * Drop-in "Pay Now" button. Handles the whole flow via
 * useRazorpayPayment and shows inline status/error feedback.
 *
 * Usage:
 *   <RazorpayCheckout
 *     orderId={order._id}
 *     amount={order.totalPrice}
 *     onPaymentSuccess={(data) => navigate(`/orders/${data.orderId}`)}
 *   />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useRazorpayPayment, PAYMENT_STATUS } from '../../hooks/useRazorpayPayment';

const BUSY_STATES = new Set([
  PAYMENT_STATUS.LOADING_SDK,
  PAYMENT_STATUS.CREATING_ORDER,
  PAYMENT_STATUS.AWAITING_USER,
  PAYMENT_STATUS.VERIFYING,
]);

const STATUS_LABEL = {
  [PAYMENT_STATUS.LOADING_SDK]: 'Loading secure checkout...',
  [PAYMENT_STATUS.CREATING_ORDER]: 'Preparing your order...',
  [PAYMENT_STATUS.AWAITING_USER]: 'Complete the payment in the popup...',
  [PAYMENT_STATUS.VERIFYING]: 'Verifying payment...',
};

export default function RazorpayCheckout({ orderId, amount, currency = 'INR', onPaymentSuccess, onPaymentFailure }) {
  const { payNow, status, error } = useRazorpayPayment({
    onSuccess: onPaymentSuccess,
    onFailure: onPaymentFailure,
  });

  const isBusy = BUSY_STATES.has(status);

  return (
    <div className="razorpay-checkout">
      <button
        type="button"
        className="razorpay-checkout__button"
        disabled={isBusy}
        onClick={() => payNow(orderId)}
        aria-busy={isBusy}
      >
        {isBusy ? STATUS_LABEL[status] : `Pay ${currency} ${amount}`}
      </button>

      {status === PAYMENT_STATUS.FAILED && error && (
        <p className="razorpay-checkout__error" role="alert">
          {error}
        </p>
      )}

      {status === PAYMENT_STATUS.CANCELLED && (
        <p className="razorpay-checkout__notice">Payment was cancelled. You can try again anytime.</p>
      )}

      {status === PAYMENT_STATUS.SUCCESS && (
        <p className="razorpay-checkout__success">Payment successful!</p>
      )}

      <p className="razorpay-checkout__methods-note">
        Pay securely via UPI, Credit/Debit Card, Net Banking, or Wallets.
      </p>
    </div>
  );
}

RazorpayCheckout.propTypes = {
  orderId: PropTypes.string.isRequired,
  amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  currency: PropTypes.string,
  onPaymentSuccess: PropTypes.func,
  onPaymentFailure: PropTypes.func,
};
