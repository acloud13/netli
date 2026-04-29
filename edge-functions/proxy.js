// edge-functions/proxy.js

// جایگزین TARGET_DOMAIN با BACKEND_URL یا هر نام دلخواه
const TARGET_BASE = (() => {
  const domain = Netlify.env.get("TARGET_DOMAIN");
  return domain ? domain.replace(/\/$/, "") : "";
})();

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  // هدرهای داخل Netlify (در صورت وجود)
  "x-nf-request-id",
  "x-nf-client-ip",
  "x-nf-deployment-id",
  "x-nf-site-id",
]);

export default async function handler(request, context) {
  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const url = new URL(request.url);
    // مسیر + کوئری را به همان شکل به دامنهٔ مقصد می‌چسبانیم
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    // کپی و پالایش هدرها
    const outHeaders = new Headers();
    let clientIp = null;
    for (const [key, value] of request.headers) {
      if (STRIP_HEADERS.has(key.toLowerCase())) continue;
      if (key.toLowerCase().startsWith("x-vercel-")) continue; // فقط در صورت وجود
      if (key.toLowerCase() === "x-real-ip") {
        clientIp = value;
        continue;
      }
      if (key.toLowerCase() === "x-forwarded-for") {
        if (!clientIp) clientIp = value;
        continue;
      }
      outHeaders.set(key, value);
    }
    if (clientIp) {
      outHeaders.set("x-forwarded-for", clientIp);
    }

    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    // ارسال درخواست به سرور مقصد
    return await fetch(targetUrl, {
      method,
      headers: outHeaders,
      body: hasBody ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    console.error("Relay error:", err);
    return new Response("Bad Gateway: Tunnel Failed", { status: 502 });
  }
}
