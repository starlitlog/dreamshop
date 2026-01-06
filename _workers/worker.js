/**
 * DreamShop - Cloudflare Worker API
 *
 * Routes: /v1/products, /v1/events, /v1/deals, /v1/create-checkout,
 *         /v1/stripe-webhook, /v1/submit-order, /v1/submit-contact
 *
 * Features: 24-hour cache, 30-day stale fallback, R2 image sync, Stripe payments
 */

// ============================================================================
// CONFIGURATION - Update these values for your shop
// ============================================================================
const SHOP_CONFIG = {
  // Your shop's main domain (used for Stripe redirects and CORS)
  SITE_URL: 'https://your-domain.com',

  // Your R2 bucket's public URL (for serving images)
  // Set up a custom domain for your R2 bucket in Cloudflare dashboard
  R2_MEDIA_URL: 'https://media.your-domain.com',

  // Allowed origins for CORS (add your domains here)
  ALLOWED_ORIGINS: [
    'https://your-domain.com',
    'https://www.your-domain.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
  ]
};
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getCorsHeaders(origin)
      });
    }

    // Allow GET and POST requests
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response('Method not allowed', { 
        status: 405,
        headers: getCorsHeaders(origin)
      });
    }

    // Route handling
    const url = new URL(request.url);
    
    try {
      // Validate required environment variables based on route
      if (url.pathname.includes('/products') || url.pathname.includes('/events') || url.pathname.includes('/deals')) {
        if (!env.AIRTABLE_API_KEY_WEB_RESOURCE || !env.AIRTABLE_BASE_ID_WEB_RESOURCE) {
          console.error('Missing web resource environment variables');
          return new Response('Server configuration error', { 
            status: 500,
            headers: getCorsHeaders(origin)
          });
        }
      } else {
        if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
          console.error('Missing order/contact environment variables');
          return new Response('Server configuration error', { 
            status: 500,
            headers: getCorsHeaders(origin)
          });
        }
      }

      // Handle GET requests (no body parsing needed)
      if (request.method === 'GET') {
        if (url.pathname.startsWith('/v1/products')) {
          return await handleProductsFetch(url, env, ctx);
        } else if (url.pathname.startsWith('/v1/events')) {
          return await handleEventsFetch(url, env, ctx);
        } else if (url.pathname.startsWith('/v1/deals')) {
          return await handleDealsFetch(url, env, ctx);
        } else {
          return new Response('Not found', {
            status: 404,
            headers: getCorsHeaders(origin)
          });
        }
      }

      // Handle Stripe webhook separately (needs raw body for signature verification)
      if (url.pathname.startsWith('/v1/stripe-webhook')) {
        return await handleStripeWebhook(request, env);
      }

      // Handle POST requests (parse body)
      const requestData = await request.json();

      if (url.pathname.startsWith('/v1/submit-order')) {
        return await handleOrderSubmission(requestData, env, origin);
      } else if (url.pathname.startsWith('/v1/submit-contact')) {
        return await handleContactSubmission(requestData, env, origin);
      } else if (url.pathname.startsWith('/v1/create-checkout')) {
        return await handleCreateCheckout(requestData, env, origin);
      } else {
        return new Response('Not found', {
          status: 404,
          headers: getCorsHeaders(origin)
        });
      }

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal server error', { 
        status: 500,
        headers: getCorsHeaders(origin)
      });
    }
  },
};

// Handle order submission
async function handleOrderSubmission(orderData, env, origin) {
  const airtableResponse = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Orders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    }
  );

  if (!airtableResponse.ok) {
    const errorText = await airtableResponse.text();
    console.error('Airtable API error:', errorText);
    return new Response('Failed to submit order', { 
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }

  const result = await airtableResponse.json();

  return new Response(JSON.stringify({ 
    success: true, 
    orderId: result.id,
    message: 'Order submitted successfully' 
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin)
    }
  });
}

// Handle contact form submission
async function handleContactSubmission(contactData, env, origin) {
  const airtableResponse = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Contacts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    }
  );

  if (!airtableResponse.ok) {
    const errorText = await airtableResponse.text();
    console.error('Airtable API error:', errorText);
    return new Response('Failed to submit contact', { 
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }

  const result = await airtableResponse.json();

  return new Response(JSON.stringify({
    success: true,
    contactId: result.id,
    message: 'Contact submitted successfully'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin)
    }
  });
}

// Stripe API base URL
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * Create Stripe Checkout Session
 * Creates an order in Airtable first, then creates Stripe session
 */
async function handleCreateCheckout(data, env, origin) {
  const { cart, customer, shipping, discount, totals } = data;

  if (!cart || cart.length === 0) {
    return new Response(JSON.stringify({ error: 'Cart is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  }

  try {
    // Build items list for Airtable
    let itemsList = cart.map(i =>
      `${i.sku ? `[${i.sku}] ` : ''}${i.name} x${i.qty}${i.selectedColor ? ` (${i.selectedColor})` : ''}${i.selectedSize ? ` [${i.selectedSize}]` : ''} - $${(i.price * i.qty).toFixed(2)}`
    ).join('\n');

    if (discount && discount.name) {
      itemsList += `\n---\n🏷️ ${discount.name}: -$${discount.amount.toFixed(2)}`;
    }

    // Create order in Airtable with Pending status
    // Address will be updated from Stripe webhook after payment
    const orderData = {
      fields: {
        'Customer Name': `${customer.firstName} ${customer.lastName}`,
        'Email': customer.email,
        'Address': customer.localPickup ? 'LOCAL PICKUP' : 'Pending (via Stripe checkout)',
        'Items': itemsList,
        'Total': totals.total,
        'Notes': customer.notes || '',
        'Status': 'Pending Payment'
      }
    };

    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Orders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      }
    );

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable error:', errorText);
      throw new Error('Failed to create order');
    }

    const airtableResult = await airtableResponse.json();
    const orderId = airtableResult.id;

    // Build Stripe line items
    const lineItems = cart.map(item => {
      let name = item.name;
      if (item.selectedColor) name += ` (${item.selectedColor})`;
      if (item.selectedSize) name += ` [${item.selectedSize}]`;

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: name,
            description: item.sku || undefined,
          },
          unit_amount: Math.round(item.price * 100), // Stripe uses cents
        },
        quantity: item.qty,
      };
    });

    // Add shipping as a line item if applicable
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    // Build Stripe Checkout session request
    const stripeParams = new URLSearchParams();
    stripeParams.append('mode', 'payment');
    stripeParams.append('success_url', `${SHOP_CONFIG.SITE_URL}?payment=success&order=${orderId}`);
    stripeParams.append('cancel_url', `${SHOP_CONFIG.SITE_URL}?payment=cancelled&order=${orderId}`);
    stripeParams.append('customer_email', customer.email);
    stripeParams.append('metadata[order_id]', orderId);
    stripeParams.append('metadata[customer_name]', `${customer.firstName} ${customer.lastName}`);
    stripeParams.append('metadata[local_pickup]', customer.localPickup ? 'true' : 'false');

    // Collect shipping address unless local pickup
    const isLocalPickup = customer.localPickup === true || customer.localPickup === 'true';
    if (!isLocalPickup) {
      stripeParams.append('shipping_address_collection[allowed_countries][0]', 'US');
      stripeParams.append('billing_address_collection', 'required');
    }

    // Add line items
    lineItems.forEach((item, index) => {
      stripeParams.append(`line_items[${index}][price_data][currency]`, item.price_data.currency);
      stripeParams.append(`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name);
      if (item.price_data.product_data.description) {
        stripeParams.append(`line_items[${index}][price_data][product_data][description]`, item.price_data.product_data.description);
      }
      stripeParams.append(`line_items[${index}][price_data][unit_amount]`, item.price_data.unit_amount);
      stripeParams.append(`line_items[${index}][quantity]`, item.quantity);
    });

    // Add discount if applicable
    if (discount && discount.amount > 0) {
      // Create a coupon for this session
      const couponParams = new URLSearchParams();
      couponParams.append('amount_off', Math.round(discount.amount * 100));
      couponParams.append('currency', 'usd');
      couponParams.append('name', discount.name);
      couponParams.append('duration', 'once');

      const couponResponse = await fetch(`${STRIPE_API_BASE}/coupons`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: couponParams.toString(),
      });

      if (couponResponse.ok) {
        const coupon = await couponResponse.json();
        stripeParams.append('discounts[0][coupon]', coupon.id);
      }
    }

    // Create Stripe Checkout session
    const stripeResponse = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams.toString(),
    });

    if (!stripeResponse.ok) {
      const stripeError = await stripeResponse.text();
      console.error('Stripe error:', stripeError);
      throw new Error('Failed to create checkout session');
    }

    const session = await stripeResponse.json();

    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      orderId: orderId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  }
}

/**
 * Handle Stripe Webhook
 * Updates order status in Airtable when payment succeeds
 */
async function handleStripeWebhook(request, env) {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  // Verify webhook signature
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing signature or webhook secret');
    return new Response('Webhook signature missing', { status: 400 });
  }

  try {
    // Parse the signature header
    const sigParts = {};
    signature.split(',').forEach(part => {
      const [key, value] = part.split('=');
      sigParts[key] = value;
    });

    const timestamp = sigParts['t'];
    const expectedSig = sigParts['v1'];

    // Verify timestamp (reject if older than 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.error('Webhook timestamp too old');
      return new Response('Webhook timestamp expired', { status: 400 });
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.STRIPE_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const computedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedSig !== expectedSig) {
      console.error('Webhook signature mismatch');
      return new Response('Invalid signature', { status: 400 });
    }

    // Parse and handle the event
    const event = JSON.parse(body);
    console.log('Stripe webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const sessionFromWebhook = event.data.object;
      const sessionId = sessionFromWebhook.id;
      const orderId = sessionFromWebhook.metadata?.order_id;
      const isLocalPickup = sessionFromWebhook.metadata?.local_pickup === 'true';

      if (orderId && sessionFromWebhook.payment_status === 'paid') {
        // Fetch full session from Stripe API to get shipping_details
        // (webhook payload may not include all fields)
        let session = sessionFromWebhook;
        try {
          const sessionResponse = await fetch(
            `${STRIPE_API_BASE}/checkout/sessions/${sessionId}`,
            {
              headers: {
                'Authorization': `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
              }
            }
          );
          if (sessionResponse.ok) {
            session = await sessionResponse.json();
            console.log('Session shipping_details:', JSON.stringify(session.shipping_details));
            console.log('Session customer_details:', JSON.stringify(session.customer_details));
          } else {
            console.error('Failed to fetch session:', await sessionResponse.text());
          }
        } catch (e) {
          console.error('Failed to fetch session details:', e);
        }

        // Build address from Stripe shipping details (if collected)
        let address = 'LOCAL PICKUP';
        if (!isLocalPickup) {
          // Try shipping_details first, then customer_details as fallback
          const shipping = session.shipping_details || {};
          const customer = session.customer_details || {};
          let addr = shipping.address;
          let name = shipping.name;

          // Fallback to customer_details if no shipping_details
          if (!addr || !addr.line1) {
            addr = customer.address || {};
            name = customer.name || '';
          }

          if (addr && addr.line1) {
            address = [
              name || '',
              addr.line1 || '',
              addr.line2 || '',
              `${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || ''}`,
              addr.country || ''
            ].filter(line => line && line.trim()).join('\n');
          } else {
            // Fallback: mark as needing address
            address = 'Shipping address not captured - check Stripe dashboard';
            console.log('No address found. shipping_details:', JSON.stringify(session.shipping_details), 'customer_details:', JSON.stringify(session.customer_details));
          }
        }

        // Update order status and address in Airtable
        const updateFields = {
          'Status': 'Paid',
          'Address': address
        };

        const updateResponse = await fetch(
          `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Orders/${orderId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: updateFields })
          }
        );

        if (!updateResponse.ok) {
          console.error('Failed to update Airtable order:', await updateResponse.text());
        } else {
          console.log(`Order ${orderId} marked as Paid with address: ${address}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Webhook error', { status: 500 });
  }
}

// R2 Media URL base (from config)
const R2_MEDIA_BASE = SHOP_CONFIG.R2_MEDIA_URL;

/**
 * Sync product images from Airtable to R2
 * - Downloads new images from Airtable attachments
 * - Deletes images no longer in Airtable
 * - Preserves original filenames
 * - Processes in parallel batches to avoid timeout
 * @param {Object} env - Worker environment with R2_BUCKET binding
 * @param {Array} products - Array of products with Airtable attachment data
 * @returns {Promise<Object>} { imageMap: Map of SKU -> R2 URLs, stats: sync statistics }
 */
async function syncProductImagesToR2(env, products) {
  const imageMap = new Map();
  const stats = {
    total_products: products.length,
    products_with_sku: 0,
    images_uploaded: 0,
    images_deleted: 0,
    images_skipped: 0,
    errors: []
  };

  // Filter products with SKU
  const productsWithSku = products.filter(p => p.sku);
  stats.products_with_sku = productsWithSku.length;

  // Process products in parallel batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < productsWithSku.length; i += BATCH_SIZE) {
    const batch = productsWithSku.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (product) => {
      const sku = product.sku;
      const airtableImages = product.airtableImages || [];
      const r2Prefix = `images/${sku}/`;

      // Get current R2 files for this SKU
      const r2List = await env.R2_BUCKET.list({ prefix: r2Prefix });
      const r2Files = new Map(r2List.objects.map(obj => [obj.key, obj]));

      // Build set of expected filenames from Airtable
      const airtableFilenames = new Set();
      const r2Urls = [];
      const uploadPromises = [];

      for (const attachment of airtableImages) {
        const filename = attachment.filename;
        airtableFilenames.add(filename);
        const r2Key = `${r2Prefix}${filename}`;
        const r2Url = `${R2_MEDIA_BASE}/${r2Key}`;
        r2Urls.push(r2Url);

        // Check if file exists in R2
        if (!r2Files.has(r2Key)) {
          // Queue upload
          uploadPromises.push(
            fetch(attachment.url)
              .then(async (response) => {
                if (response.ok) {
                  const imageData = await response.arrayBuffer();
                  const contentType = response.headers.get('content-type') || 'image/jpeg';
                  await env.R2_BUCKET.put(r2Key, imageData, {
                    httpMetadata: { contentType }
                  });
                  console.log(`Uploaded: ${r2Key}`);
                  stats.images_uploaded++;
                } else {
                  stats.errors.push(`Failed to fetch ${filename} for ${sku}: HTTP ${response.status}`);
                }
              })
              .catch((error) => {
                console.error(`Failed to sync image ${r2Key}:`, error);
                stats.errors.push(`Failed to sync ${filename} for ${sku}: ${error.message}`);
              })
          );
        } else {
          stats.images_skipped++;
        }
      }

      // Wait for all uploads for this product
      await Promise.all(uploadPromises);

      // Delete R2 files not in Airtable
      const deletePromises = [];
      for (const [r2Key] of r2Files) {
        const filename = r2Key.replace(r2Prefix, '');
        if (!airtableFilenames.has(filename)) {
          deletePromises.push(
            env.R2_BUCKET.delete(r2Key)
              .then(() => {
                console.log(`Deleted: ${r2Key}`);
                stats.images_deleted++;
              })
              .catch((error) => {
                console.error(`Failed to delete ${r2Key}:`, error);
                stats.errors.push(`Failed to delete ${r2Key}: ${error.message}`);
              })
          );
        }
      }
      await Promise.all(deletePromises);

      imageMap.set(sku, r2Urls);
    }));
  }

  return { imageMap, stats };
}

/**
 * Sync event images from Airtable to R2
 * Similar to product sync but uses event ID as folder
 * @param {Object} env - Worker environment with R2_BUCKET binding
 * @param {Array} events - Array of events with Airtable attachment data
 * @returns {Promise<Object>} { imageMap: Map of eventId -> R2 URLs, stats: sync statistics }
 */
async function syncEventImagesToR2(env, events) {
  const imageMap = new Map();
  const stats = {
    total_events: events.length,
    events_with_images: 0,
    images_uploaded: 0,
    images_deleted: 0,
    images_skipped: 0,
    errors: []
  };

  // Filter events with images
  const eventsWithImages = events.filter(e => e.airtableImages && e.airtableImages.length > 0);
  stats.events_with_images = eventsWithImages.length;

  // Process events in parallel batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < eventsWithImages.length; i += BATCH_SIZE) {
    const batch = eventsWithImages.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (event) => {
      const eventId = event.id;
      const airtableImages = event.airtableImages || [];
      const r2Prefix = `events/${eventId}/`;

      // Get current R2 files for this event
      const r2List = await env.R2_BUCKET.list({ prefix: r2Prefix });
      const r2Files = new Map(r2List.objects.map(obj => [obj.key, obj]));

      // Build set of expected filenames from Airtable
      const airtableFilenames = new Set();
      const r2Urls = [];
      const uploadPromises = [];

      for (const attachment of airtableImages) {
        const filename = attachment.filename;
        airtableFilenames.add(filename);
        const r2Key = `${r2Prefix}${filename}`;
        const r2Url = `${R2_MEDIA_BASE}/${r2Key}`;
        r2Urls.push(r2Url);

        // Check if file exists in R2
        if (!r2Files.has(r2Key)) {
          // Queue upload
          uploadPromises.push(
            fetch(attachment.url)
              .then(async (response) => {
                if (response.ok) {
                  const imageData = await response.arrayBuffer();
                  const contentType = response.headers.get('content-type') || 'image/jpeg';
                  await env.R2_BUCKET.put(r2Key, imageData, {
                    httpMetadata: { contentType }
                  });
                  console.log(`Uploaded event image: ${r2Key}`);
                  stats.images_uploaded++;
                } else {
                  stats.errors.push(`Failed to fetch ${filename} for event ${eventId}: HTTP ${response.status}`);
                }
              })
              .catch((error) => {
                console.error(`Failed to sync event image ${r2Key}:`, error);
                stats.errors.push(`Failed to sync ${filename} for event ${eventId}: ${error.message}`);
              })
          );
        } else {
          stats.images_skipped++;
        }
      }

      // Wait for all uploads for this event
      await Promise.all(uploadPromises);

      // Delete R2 files not in Airtable
      const deletePromises = [];
      for (const [r2Key] of r2Files) {
        const filename = r2Key.replace(r2Prefix, '');
        if (!airtableFilenames.has(filename)) {
          deletePromises.push(
            env.R2_BUCKET.delete(r2Key)
              .then(() => {
                console.log(`Deleted event image: ${r2Key}`);
                stats.images_deleted++;
              })
              .catch((error) => {
                console.error(`Failed to delete ${r2Key}:`, error);
                stats.errors.push(`Failed to delete ${r2Key}: ${error.message}`);
              })
          );
        }
      }
      await Promise.all(deletePromises);

      imageMap.set(eventId, r2Urls);
    }));
  }

  return { imageMap, stats };
}

// Handle products fetch with caching
async function handleProductsFetch(url, env, ctx) {
  const params = new URLSearchParams(url.search);
  const refresh = params.get('refresh') === 'true';
  const adminKey = params.get('key');
  
  // Check admin key if refresh is requested
  if (refresh && adminKey !== env.ADMIN_REFRESH_KEY) {
    return new Response('Unauthorized cache refresh', {
      status: 401,
      headers: getCorsHeaders()
    });
  }
  
  // Cache key for products
  const cacheKey = new Request('https://cache.dreamshop.internal/products', {
    method: 'GET',
    headers: { 'cf-cache': 'products-v1' }
  });

  // Try to get from cache first (unless refresh requested)
  let response;
  let cacheStatus = 'MISS';
  
  if (!refresh) {
    response = await caches.default.match(cacheKey);
    if (response) {
      cacheStatus = 'HIT';
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': cacheStatus,
          'Cache-Control': 'public, max-age=86400', // 24 hours
          ...getCorsHeaders()
        }
      });
    }
  }

  try {
    // Fetch ALL active products from Airtable (no pagination for cache)
    const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID_WEB_RESOURCE}/Products?filterByFormula={Active}=1&sort[0][field]=Pinned&sort[0][direction]=desc&sort[1][field]=Name&sort[1][direction]=asc`;

    const airtableResponse = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${env.AIRTABLE_API_KEY_WEB_RESOURCE}`,
        'Content-Type': 'application/json'
      }
    });

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable API error:', errorText);
      return new Response('Failed to fetch products', { 
        status: 500,
        headers: getCorsHeaders(origin)
      });
    }

    let allRecords = [];
    let data = await airtableResponse.json();
    allRecords = allRecords.concat(data.records);

    // Handle pagination to get ALL products
    while (data.offset) {
      const nextUrl = `${airtableUrl}&offset=${data.offset}`;
      const nextResponse = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${env.AIRTABLE_API_KEY_WEB_RESOURCE}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (nextResponse.ok) {
        data = await nextResponse.json();
        allRecords = allRecords.concat(data.records);
      } else {
        break;
      }
    }
    
    // First pass: extract products with Airtable image data for R2 sync
    const productsWithAirtableImages = allRecords.map(record => ({
      id: record.id,
      sku: record.fields['SKU'] || null,
      name: record.fields['Name'],
      description: record.fields['Description'] || '',
      price: record.fields['Price'],
      airtableImages: record.fields['Images'] || [],
      madeByMe: record.fields['Made By Me'] || false,
      colors: record.fields['Colors'] || [],
      sizes: record.fields['Sizes'] || [],
      tags: record.fields['Tags'] || [],
      pinned: record.fields['Pinned'] || false
    }));

    // Sync images to R2 (runs during cache refresh)
    const { imageMap: r2ImageMap, stats: syncStats } = await syncProductImagesToR2(env, productsWithAirtableImages);

    // Transform products with R2 URLs for frontend
    const products = productsWithAirtableImages.map(product => {
      const r2Images = product.sku ? r2ImageMap.get(product.sku) || [] : [];
      const hasR2Images = r2Images.length > 0;

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        images: hasR2Images ? r2Images : product.airtableImages.map(img => img.url),
        image: hasR2Images
          ? r2Images[0]
          : (product.airtableImages.length > 0
              ? product.airtableImages[0].url
              : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop'),
        madeByMe: product.madeByMe,
        colors: product.colors,
        sizes: product.sizes,
        tags: product.tags,
        pinned: product.pinned
      };
    });

    // Create response with cache metadata and sync stats
    const responseData = {
      records: products,
      cached_at: new Date().toISOString(),
      total_count: products.length,
      sync_stats: syncStats
    };

    response = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': cacheStatus,
        'Cache-Control': 'public, max-age=86400', // 24 hours cache
        ...getCorsHeaders(origin)
      }
    });

    // Store in cache for 1 hour
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    
    return response;

  } catch (error) {
    console.error('Products fetch error:', error);
    
    // Try to serve stale cache as fallback when Airtable fails
    const staleResponse = await caches.default.match(cacheKey);
    if (staleResponse) {
      console.log('Serving stale cache due to Airtable error');
      const data = await staleResponse.text();
      return new Response(data, {
        status: staleResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'STALE-ERROR',
          'Cache-Control': 'public, max-age=2592000', // 30 days for error fallback
          'X-Error': 'Airtable-Unavailable',
          ...getCorsHeaders()
        }
      });
    }
    
    // Last resort: return error if no stale cache available
    return new Response('Failed to fetch products', { 
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}

// Handle events fetch with caching
async function handleEventsFetch(url, env, ctx) {
  const params = new URLSearchParams(url.search);
  const refresh = params.get('refresh') === 'true';
  const adminKey = params.get('key');
  
  // Check admin key if refresh is requested
  if (refresh && adminKey !== env.ADMIN_REFRESH_KEY) {
    return new Response('Unauthorized cache refresh', {
      status: 401,
      headers: getCorsHeaders()
    });
  }
  
  // Cache key for events
  const cacheKey = new Request('https://cache.dreamshop.internal/events', {
    method: 'GET',
    headers: { 'cf-cache': 'events-v1' }
  });

  // Try to get from cache first (unless refresh requested)
  let response;
  let cacheStatus = 'MISS';
  
  if (!refresh) {
    response = await caches.default.match(cacheKey);
    if (response) {
      cacheStatus = 'HIT';
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': cacheStatus,
          'Cache-Control': 'public, max-age=86400', // 24 hours
          ...getCorsHeaders()
        }
      });
    }
  }

  try {
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID_WEB_RESOURCE}/Events?sort[0][field]=Date&sort[0][direction]=asc`,
      {
        headers: {
          'Authorization': `Bearer ${env.AIRTABLE_API_KEY_WEB_RESOURCE}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable API error:', errorText);
      return new Response('Failed to fetch events', { 
        status: 500,
        headers: getCorsHeaders(origin)
      });
    }

    const data = await airtableResponse.json();

    // First pass: extract events with Airtable image data for R2 sync
    const eventsWithAirtableImages = data.records.map(record => ({
      id: record.id,
      name: record.fields['Name'] || record.fields['Event Name'],
      location: record.fields['Location'],
      date: record.fields['Date'],
      time: record.fields['Time'],
      startTime: record.fields['Start Time'],
      endTime: record.fields['End Time'],
      eventType: record.fields['Event Type'],
      city: record.fields['City'],
      state: record.fields['State'],
      description: record.fields['Description'] || '',
      website: record.fields['Website'],
      status: record.fields['Status'] || 'Upcoming',
      featured: record.fields['Featured'] || false,
      airtableImages: record.fields['Image'] || record.fields['Images'] || [],
      specialItems: record.fields['Special Items'] || '',
      notes: record.fields['Notes'] || ''
    }));

    // Sync images to R2 (runs during cache refresh)
    const { imageMap: r2ImageMap, stats: syncStats } = await syncEventImagesToR2(env, eventsWithAirtableImages);

    // Transform events with R2 URLs for frontend
    const events = eventsWithAirtableImages.map(event => {
      const r2Images = r2ImageMap.get(event.id) || [];
      const hasR2Images = r2Images.length > 0;

      return {
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date,
        time: event.time,
        startTime: event.startTime,
        endTime: event.endTime,
        eventType: event.eventType,
        city: event.city,
        state: event.state,
        description: event.description,
        website: event.website,
        status: event.status,
        featured: event.featured,
        images: hasR2Images ? r2Images : event.airtableImages.map(img => typeof img === 'string' ? img : img.url),
        specialItems: event.specialItems,
        notes: event.notes
      };
    });

    // Create response with cache metadata and sync stats
    const responseData = {
      records: events,
      cached_at: new Date().toISOString(),
      total_count: events.length,
      sync_stats: syncStats
    };

    response = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': cacheStatus,
        'Cache-Control': 'public, max-age=86400', // 24 hours cache
        ...getCorsHeaders(origin)
      }
    });

    // Store in cache for 1 hour
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    
    return response;

  } catch (error) {
    console.error('Events fetch error:', error);
    
    // Try to serve stale cache as fallback when Airtable fails
    const staleResponse = await caches.default.match(cacheKey);
    if (staleResponse) {
      console.log('Serving stale events cache due to Airtable error');
      const data = await staleResponse.text();
      return new Response(data, {
        status: staleResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'STALE-ERROR',
          'Cache-Control': 'public, max-age=2592000', // 30 days for error fallback
          'X-Error': 'Airtable-Unavailable',
          ...getCorsHeaders()
        }
      });
    }
    
    // Last resort: return error if no stale cache available
    return new Response('Failed to fetch events', { 
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}

// Handle deals fetch with caching
async function handleDealsFetch(url, env, ctx) {
  const params = new URLSearchParams(url.search);
  const refresh = params.get('refresh') === 'true';
  const adminKey = params.get('key');
  
  // Check admin key if refresh is requested
  if (refresh && adminKey !== env.ADMIN_REFRESH_KEY) {
    return new Response('Unauthorized cache refresh', {
      status: 401,
      headers: getCorsHeaders()
    });
  }
  
  // Cache key for deals
  const cacheKey = new Request('https://cache.dreamshop.internal/deals', {
    method: 'GET',
    headers: { 'cf-cache': 'deals-v1' }
  });

  // Try to get from cache first (unless refresh requested)
  let response;
  let cacheStatus = 'MISS';
  
  if (!refresh) {
    response = await caches.default.match(cacheKey);
    if (response) {
      cacheStatus = 'HIT';
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': cacheStatus,
          'Cache-Control': 'public, max-age=86400', // 24 hours
          ...getCorsHeaders()
        }
      });
    }
  }

  try {
    // Only fetch active deals
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID_WEB_RESOURCE}/Deals?filterByFormula={Active}=1&sort[0][field]=Min%20Amount&sort[0][direction]=asc`,
      {
        headers: {
          'Authorization': `Bearer ${env.AIRTABLE_API_KEY_WEB_RESOURCE}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable API error:', errorText);
      return new Response('Failed to fetch deals', {
        status: 500,
        headers: getCorsHeaders(origin)
      });
    }

    const data = await airtableResponse.json();

    // Transform deals to match frontend format
    const deals = data.records.map(record => ({
      id: record.id,
      name: record.fields['Name'],
      description: record.fields['Description'] || '',
      minAmount: record.fields['Min Amount'] || 0,
      discountValue: record.fields['Discount Value'] || 0,
      discountType: record.fields['Discount Type'] || 'Percentage',
      active: record.fields['Active'] || false
    }));

    // Create response with cache metadata
    const responseData = {
      records: deals,
      cached_at: new Date().toISOString(),
      total_count: deals.length
    };

    response = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': cacheStatus,
        'Cache-Control': 'public, max-age=86400', // 24 hours cache
        ...getCorsHeaders(origin)
      }
    });

    // Store in cache for 1 hour
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    
    return response;

  } catch (error) {
    console.error('Deals fetch error:', error);
    
    // Try to serve stale cache as fallback when Airtable fails
    const staleResponse = await caches.default.match(cacheKey);
    if (staleResponse) {
      console.log('Serving stale deals cache due to Airtable error');
      const data = await staleResponse.text();
      return new Response(data, {
        status: staleResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'STALE-ERROR',
          'Cache-Control': 'public, max-age=2592000', // 30 days for error fallback
          'X-Error': 'Airtable-Unavailable',
          ...getCorsHeaders()
        }
      });
    }
    
    // Last resort: return error if no stale cache available
    return new Response('Failed to fetch deals', { 
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}

function getCorsHeaders(origin) {
  const allowedOrigins = SHOP_CONFIG.ALLOWED_ORIGINS;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : SHOP_CONFIG.SITE_URL;
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

// For stricter CORS in production, use this instead:
function getCorsHeadersStrict(origin) {
  const allowedOrigins = SHOP_CONFIG.ALLOWED_ORIGINS;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'null';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}