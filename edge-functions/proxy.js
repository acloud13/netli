// netlify/edge-functions/proxy.js

// Read the backend URL from environment variables,
// fallback value is just a placeholder – you must set it in Netlify.
const BACKEND_URL = Netlify.env.get("BACKEND_URL") || "https://your-backend-server.com";

export default async function handler(request, context) {
  try {
    const url = new URL(request.url);
    // Keep the original path + query string
    const targetPath = url.pathname + url.search;
    const upstreamUrl = new URL(targetPath, BACKEND_URL).toString();

    // Copy headers from the incoming request
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("x-forwarded-proto");
    headers.delete("x-forwarded-host");

    // Build the request to your backend – the body is streamed directly
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: headers,
      body: request.body,   // ReadableStream, no buffering
      redirect: "manual",
    });

    // Forward the request
    const upstreamResponse = await fetch(upstreamRequest);

    // Prepare response headers, drop hop‑by‑hop headers
    const responseHeaders = new Headers();
    for (const [key, value] of upstreamResponse.headers.entries()) {
      if (!["transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    }

    // Return the upstream response, its body remains a ReadableStream
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(`Proxy Error: ${error.message}`, { status: 502 });
  }
}
