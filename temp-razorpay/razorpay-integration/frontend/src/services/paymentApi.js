/**
 * services/paymentApi.js
 *
 * Thin axios wrapper around the backend payment endpoints.
 * Install with: npm install axios
 *
 * Assumes you already have an auth token stored (e.g. in localStorage
 * or a context) after login — adjust getAuthToken() to your setup.
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

function getAuthToken() {
  return localStorage.getItem('token');
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Creates a Razorpay order on the backend for the given internal orderId.
 * Returns { razorpayOrderId, amount, currency, keyId, orderId, prefill }
 */
export async function createPaymentOrder(orderId) {
  const { data } = await apiClient.post('/payments/create-order', { orderId });
  return data.data;
}

/**
 * Sends the Checkout success payload to the backend for signature
 * verification. Only after this resolves successfully is the order
 * considered paid.
 */
export async function verifyPayment(payload) {
  const { data } = await apiClient.post('/payments/verify', payload);
  return data;
}

/**
 * Reports a client-observed payment failure/cancellation so the
 * backend can update state immediately (the webhook will also catch
 * this, but this gives faster UI feedback).
 */
export async function reportPaymentFailure(payload) {
  const { data } = await apiClient.post('/payments/failure', payload);
  return data;
}

/**
 * Polls the authoritative payment/order status from the backend.
 */
export async function getPaymentStatus(orderId) {
  const { data } = await apiClient.get(`/payments/status/${orderId}`);
  return data.data;
}

export default apiClient;
