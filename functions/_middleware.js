/**
 * Converts request headers to a loggable object without changing their values.
 *
 * @param {Headers} headers Incoming request headers.
 * @returns {Record<string, string>} Serializable request headers.
 */
function serializeHeaders(headers) {
  return Object.fromEntries(headers.entries());
}

/**
 * Sends a structured request log to an optional external HTTP collector.
 *
 * @param {Record<string, unknown>} env Pages environment bindings.
 * @param {Record<string, unknown>} log Structured request log.
 * @returns {Promise<void>} Completes after the collector accepts the log.
 * @throws {Error} When the collector responds with a non-success status.
 */
async function sendExternalLog(env, log) {
  if (!env.LOG_ENDPOINT) {
    return;
  }

  const headers = new Headers({
    "content-type": "application/json",
  });

  if (env.LOG_TOKEN) {
    headers.set("authorization", `Bearer ${env.LOG_TOKEN}`);
  }

  const response = await fetch(env.LOG_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(log),
  });

  if (!response.ok) {
    throw new Error(`Log endpoint returned ${response.status}`);
  }
}

/**
 * Writes a request log to Cloudflare and optionally schedules external storage.
 *
 * @param {EventContext<Record<string, unknown>, string, Record<string, unknown>>} context Pages request context.
 * @param {Record<string, unknown>} log Structured request log.
 * @returns {void}
 */
function writeLog(context, log) {
  console.log(log);

  if (!context.env.LOG_ENDPOINT) {
    return;
  }

  context.waitUntil(
    sendExternalLog(context.env, log).catch((error) => {
      console.error({
        type: "log_delivery_error",
        requestId: log.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }),
  );
}

/**
 * Logs every Pages request, including static files, response status and latency.
 *
 * @param {EventContext<Record<string, unknown>, string, Record<string, unknown>>} context Pages request context.
 * @returns {Promise<Response>} Response produced by the matching Function or asset.
 * @throws {unknown} Re-throws downstream errors after recording them.
 */
export async function onRequest(context) {
  const { request } = context;
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();

  context.data.requestId = requestId;

  const requestLog = {
    type: "http_request",
    timestamp: new Date().toISOString(),
    requestId,
    method: request.method,
    path: incoming.pathname,
    query: incoming.search,
    headers: serializeHeaders(request.headers),
    client: {
      ip: request.headers.get("cf-connecting-ip"),
      country: request.cf?.country,
      city: request.cf?.city,
      colo: request.cf?.colo,
      asn: request.cf?.asn,
      httpProtocol: request.cf?.httpProtocol,
      tlsVersion: request.cf?.tlsVersion,
    },
  };

  try {
    const response = await context.next();

    writeLog(context, {
      ...requestLog,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return response;
  } catch (error) {
    writeLog(context, {
      ...requestLog,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}
