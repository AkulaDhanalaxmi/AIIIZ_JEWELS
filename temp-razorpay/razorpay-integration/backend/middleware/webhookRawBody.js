/**
 * middleware/webhookRawBody.js
 *
 * Razorpay signs the EXACT raw bytes of the webhook request body.
 * If you parse JSON first and re-verify against the re-serialized
 * object, key ordering/whitespace differences will break the
 * signature check. This middleware captures the raw body onto
 * `req.rawBody` before Express's json parser touches it.
 *
 * Mount this ONLY on the webhook route, with express.json's verify
 * option, e.g.:
 *
 *   router.post(
 *     '/webhook',
 *     express.json({ verify: rawBodySaver }),
 *     webhookController
 *   );
 */

function rawBodySaver(req, res, buf) {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
}

module.exports = rawBodySaver;
