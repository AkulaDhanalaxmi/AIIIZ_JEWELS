/**
 * components/Checkout/PaymentStatus.jsx
 *
 * Shows the backend's authoritative payment/order status for an
 * order, polling briefly in case the webhook is still catching up
 * (common with UPI intent flows where the redirect can beat the
 * webhook by a second or two).
 *
 * Usage:
 *   <PaymentStatus orderId={order._id} />
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { getPaymentStatus } from '../../services/paymentApi';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10;

export default function PaymentStatus({ orderId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const pollCount = useRef(0);

  useEffect(() => {
    let timerId;
    let cancelled = false;

    async function poll() {
      try {
        const result = await getPaymentStatus(orderId);
        if (cancelled) return;

        setData(result);
        setLoading(false);

        const isSettled = result.paymentStatus === 'PAID' || result.paymentStatus === 'FAILED';
        pollCount.current += 1;

        if (!isSettled && pollCount.current < MAX_POLLS) {
          timerId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err.response?.data?.message || 'Could not fetch payment status.');
        setLoading(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [orderId]);

  if (loading) return <p>Checking payment status...</p>;
  if (errorMsg) return <p role="alert">{errorMsg}</p>;
  if (!data) return null;

  return (
    <div className="payment-status">
      <p>
        Order status: <strong>{data.orderStatus}</strong>
      </p>
      <p>
        Payment status: <strong>{data.paymentStatus}</strong>
      </p>
      {data.razorpayPaymentId && <p>Payment ID: {data.razorpayPaymentId}</p>}
      {data.method && <p>Method: {data.method.toUpperCase()}</p>}
      {data.paymentStatus === 'PENDING' && (
        <p>Your payment is still being confirmed. This page will update automatically.</p>
      )}
    </div>
  );
}

PaymentStatus.propTypes = {
  orderId: PropTypes.string.isRequired,
};
