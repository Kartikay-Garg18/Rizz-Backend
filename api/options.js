// api/options.js - Special handler for preflight requests
export default function handler(req, res) {
  // Log the request for debugging
  console.log(`PREFLIGHT HANDLER: ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // End the preflight request successfully
  res.status(204).end();
}
