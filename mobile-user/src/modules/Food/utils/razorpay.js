/**
 * Razorpay Payment Integration Utility
 * Handles Razorpay payment initialization and verification.
 *
 * Same exported API as the web (loadRazorpayScript, preloadRazorpayScript, initRazorpayPayment, formatAmount).
 * In the app the checkout runs through @/lib/razorpay (Razorpay's checkout.js in the payment WebView host), so there
 * is no script to load. The key always comes from the caller (backend order response / env), never hard-coded here.
 */
import { Razorpay, isRazorpayAvailable, loadRazorpayScript as loadNativeCheckout } from '@/lib/razorpay';

const SITE_ORIGIN = String(globalThis.__ENV__?.VITE_PUBLIC_APP_URL || 'https://foodie.org.in').replace(/\/$/, '');

let razorpayLoaded = false;

/**
 * Load Razorpay checkout (nothing to download in the app; resolves once the payment host is mounted)
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (razorpayLoaded) {
      resolve();
      return;
    }
    loadNativeCheckout()
      .then(() => {
        if (!isRazorpayAvailable()) {
          reject(new Error('Failed to load Razorpay script'));
          return;
        }
        razorpayLoaded = true;
        resolve();
      })
      .catch(() => reject(new Error('Failed to load Razorpay script')));
  });
};

/**
 * Preload the Razorpay SDK in the background (call early, e.g. on cart mount)
 * so that when the user clicks "Place Order", the script is already ready.
 */
export const preloadRazorpayScript = () => {
  loadRazorpayScript().catch(() => {
    // Silently ignore — will retry when payment is initiated
  });
};

const absoluteImage = (src) => {
  const s = String(src || '');
  if (!s) return `${SITE_ORIGIN}/foodie-icon.webp`;
  if (/^(https?:|data:)/i.test(s)) return s;
  return `${SITE_ORIGIN}${s.startsWith('/') ? '' : '/'}${s}`;
};

/**
 * Initialize Razorpay payment
 * @param {Object} options - Payment options (key, amount, currency, order_id, name, description, prefill, notes,
 *   handler, onError, onClose) — same as the web.
 */
export const initRazorpayPayment = async (options) => {
  try {
    await loadRazorpayScript();

    let paymentCompleted = false;
    let closeFired = false;

    // Fire the onClose callback exactly once
    const fireClose = () => {
      if (!paymentCompleted && !closeFired) {
        closeFired = true;
        if (options.onClose) {
          options.onClose();
        }
      }
    };

    // NOTE: we intentionally do NOT treat "app came back from the UPI app" as a cancel.
    // Razorpay needs a few seconds after the user returns to confirm the payment; closing
    // early hid the "Placing your order" screen, flashed the cart and showed a false
    // "payment not completed" message. Real cancels are reported by Razorpay itself via
    // modal.ondismiss and the payment.failed event below.

    const razorpayOptions = {
      key: options.key,
      amount: options.amount,
      currency: options.currency || 'INR',
      order_id: options.order_id,
      name: options.name || 'Foodie',
      description: options.description || 'Order Payment',
      image: absoluteImage(options.image || '/foodie-icon.webp'),
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || '',
      },
      notes: options.notes || {},
      theme: {
        color: '#E23744',
      },
      handler: function (response) {
        paymentCompleted = true;
        closeFired = true; // Prevent onClose from also firing after success
        if (options.handler) {
          options.handler(response);
        }
      },
      modal: {
        ondismiss: function() {
          fireClose();
        },
        escape: true,
        animation: true,
        handleback: true,
      },
      retry: {
        enabled: false,
      },
    };

    const razorpay = new Razorpay(razorpayOptions);

    razorpay.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response);
      if (options.onError) {
        options.onError(response?.error || { description: 'Payment failed. Please try again.' });
      }
    });

    razorpay.open();

    return razorpay;
  } catch (error) {
    console.error('Error initializing Razorpay:', error);
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
};

/**
 * Format amount for display
 * @param {Number} amount - Amount in paise
 * @returns {String} Formatted amount string
 */
export const formatAmount = (amount) => {
  return `₹${(amount / 100).toFixed(2)}`;
};
