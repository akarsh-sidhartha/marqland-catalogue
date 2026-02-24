// Update this logic in your frontend components
export const getBaseUrl = () => {
  const { hostname, protocol, port } = window.location;
  
  // If we are not on localhost, use the current domain without a port
  // Cloudflare handles the routing to your backend.
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}/api`;
  }
  
  // Local development uses port 5000
  return `http://localhost:5000/api`;
};