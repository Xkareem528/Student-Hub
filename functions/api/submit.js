const WORKER_API = "https://student-hub.kareemahmedhussein4.workers.dev/api/submit";

export async function onRequestPost({ request }) {
  const body = await request.arrayBuffer();

  const upstream = await fetch(WORKER_API, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") || "application/json"
    },
    body
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
