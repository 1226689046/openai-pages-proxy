const UPSTREAM = "https://downstream.jbbtoken.cn";

export async function onRequest(context) {
  const { request, env } = context;
  const incoming = new URL(request.url);

  if (
    env.PROXY_TOKEN &&
    request.headers.get("x-proxy-token") !== env.PROXY_TOKEN
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const target = new URL(
    incoming.pathname + incoming.search,
    UPSTREAM
  );

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("x-proxy-token");

  if (context.data.requestId) {
    headers.set("x-request-id", context.data.requestId);
  }

  return fetch(new Request(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : request.body,
    redirect: "manual",
  }));
}
