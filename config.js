// config.js - DreamShop Configuration
// Update these values for your shop

const CONFIG = {
  // API endpoint - your Cloudflare Worker URL
  API_BASE_URL: 'https://api.your-domain.com/v1',

  // Shipping
  SHIPPING_FLAT_RATE: 10,           // Flat rate shipping cost ($)
  FREE_SHIPPING_THRESHOLD: 25,      // Free shipping on orders above this ($)

  // Shop Info
  SHOP_NAME: 'Your Shop Name',
  SHOP_EMAIL: 'hello@your-domain.com'
};
