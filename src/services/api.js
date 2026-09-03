import { getApiBaseUrl } from "../config";

async function parseError(res) {
  try {
    const err = await res.json();
    const detail = err.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(" ");
    return JSON.stringify(detail || err);
  } catch {
    return `Request failed (${res.status})`;
  }
}

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const base = getApiBaseUrl();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(`Cannot reach Homatri server at ${base}. (${error.message})`);
  }
  if (!response.ok) throw new Error(await parseError(response));
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function registerMobileUser({ phone, email, password, fullName }) {
  return apiRequest("/api/v1/auth/register", {
    method: "POST",
    body: { phone, email, password, full_name: fullName },
  });
}

export async function loginMobileUser({ phone, password }) {
  return apiRequest("/api/v1/auth/login", { method: "POST", body: { phone, password } });
}

export async function submitRiderOnboarding(body, token) {
  return apiRequest("/api/v1/auth/onboarding/rider", { method: "POST", token, body });
}

export async function fetchRiderTrip(token) {
  return apiRequest("/api/v1/rider/me/trip", { token });
}

export async function riderSetShift(on, token) {
  return apiRequest("/api/v1/rider/me/shift", { method: "POST", token, body: { on } });
}

export async function riderConfirmPickup(token) {
  return apiRequest("/api/v1/rider/me/pickup", { method: "POST", token });
}

export async function riderDeliver(orderId, otp, token) {
  return apiRequest("/api/v1/rider/me/deliver", { method: "POST", token, body: { order_id: orderId, otp } });
}

export async function riderConfirmGate(deliveries, token) {
  return apiRequest("/api/v1/rider/me/confirm-gate", { method: "POST", token, body: { deliveries } });
}

export async function riderUndelivered(orderId, reason, token) {
  return apiRequest("/api/v1/rider/me/undelivered", {
    method: "POST",
    token,
    body: { order_id: orderId, reason },
  });
}

export async function riderCodCollected(orderId, token) {
  return apiRequest("/api/v1/rider/me/cod-collected", {
    method: "POST",
    token,
    body: { order_id: orderId },
  });
}

export async function riderReport(kind, token, orderId) {
  return apiRequest("/api/v1/rider/me/report", { method: "POST", token, body: { kind, order_id: orderId } });
}

export async function riderSos(token) {
  return apiRequest("/api/v1/rider/me/sos", { method: "POST", token });
}

export function riderLocationWsUrl(token) {
  const http = getApiBaseUrl().replace(/\/$/, "");
  const ws = http.startsWith("https://")
    ? http.replace(/^https:\/\//, "wss://")
    : http.replace(/^http:\/\//, "ws://");
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${ws}/ws/v1/rider/location${q}`;
}
