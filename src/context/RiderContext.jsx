import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  fetchRiderTrip,
  riderConfirmGate,
  riderConfirmPickup,
  riderDeliver,
  riderLocationWsUrl,
  riderCodCollected,
  riderReport,
  riderSetShift,
  riderSos,
  riderUndelivered,
} from "../services/api";
import { groupPendingStops } from "../lib/riderTrip";

const RiderContext = createContext(null);

export function RiderProvider({ children, token }) {
  const [trip, setTrip] = useState(null);
  const [helpNotice, setHelpNotice] = useState(null);
  const [lastGpsAt, setLastGpsAt] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const socketRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setTrip(null);
      setLoading(false);
      return;
    }
    const data = await fetchRiderTrip(token);
    setTrip(data);
    if (data?.gps?.timestamp) setLastGpsAt(data.gps.timestamp);
    return data;
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    refresh()
      .catch((err) => !cancelled && setHelpNotice(err.message))
      .finally(() => !cancelled && setLoading(false));
    const id = setInterval(() => refresh().catch(() => {}), 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh, token]);

  const shiftOn = Boolean(trip?.shift_on);
  const stops = trip?.stops || [];
  const currentGroup = groupPendingStops(stops);
  const pendingStops = stops.filter((s) => s.status === "PENDING");
  const remainingStops = new Set(pendingStops.map((s) => s.gateId)).size;
  const tiffinCount = trip?.tiffinCount || 0;
  const machineState = trip?.machineState || (shiftOn ? "ON_SHIFT" : "OFF_SHIFT");
  const pickupDone = Boolean(trip?.pickupDone);
  const windowInfo = trip?.windowInfo
    ? {
        label: trip.windowInfo.label,
        mealWindow: trip.windowInfo.meal_window || trip.windowInfo.mealWindow,
        cutoffTime: trip.windowInfo.cutoff_time || trip.windowInfo.cutoffTime,
      }
    : { label: "", mealWindow: "LUNCH", cutoffTime: "" };

  const withBusy = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleShift = useCallback(async () => {
    try {
      const data = await riderSetShift(!shiftOn, token);
      setTrip(data);
      setHelpNotice(null);
    } catch (err) {
      setHelpNotice(err.message);
    }
  }, [shiftOn, token]);

  const confirmPickup = useCallback(
    () =>
      withBusy(async () => {
        try {
          const data = await riderConfirmPickup(token);
          setTrip(data);
          setHelpNotice("Pickup confirmed.");
        } catch (err) {
          setHelpNotice(err.message);
        }
      }),
    [token, withBusy]
  );

  // /me/deliver and /me/confirm-gate auto-mark COD as collected; this catches any
  // COD order that still reports COD_PENDING afterwards and closes it explicitly.
  const reconcileCod = useCallback(
    async (data, orderIds) => {
      const ids = new Set(orderIds);
      const stragglers = (data?.stops || []).filter(
        (stop) =>
          ids.has(stop.orderId) &&
          stop.paymentMethod === "COD" &&
          stop.paymentStatus === "COD_PENDING"
      );
      for (const stop of stragglers) {
        await riderCodCollected(stop.orderId, token);
      }
      if (stragglers.length) {
        const fresh = await fetchRiderTrip(token);
        setTrip(fresh);
      }
    },
    [token]
  );

  const markDelivered = useCallback(
    (orderId, otp) =>
      withBusy(async () => {
        if (!otp) {
          setHelpNotice("Enter the customer’s 4-digit delivery PIN.");
          return;
        }
        try {
          const data = await riderDeliver(orderId, otp, token);
          setTrip(data);
          await reconcileCod(data, [orderId]);
        } catch (err) {
          setHelpNotice(err.message);
        }
      }),
    [token, withBusy, reconcileCod]
  );

  const confirmAllAtGate = useCallback(
    (deliveries) =>
      withBusy(async () => {
        const rows = (deliveries || []).map((row) =>
          typeof row === "string" ? { order_id: row, otp: "" } : row
        );
        if (rows.some((row) => !row.otp)) {
          setHelpNotice("Every order at the gate needs a delivery PIN.");
          return;
        }
        try {
          const data = await riderConfirmGate(rows, token);
          setTrip(data);
          await reconcileCod(data, rows.map((row) => row.order_id));
        } catch (err) {
          setHelpNotice(err.message);
        }
      }),
    [token, withBusy, reconcileCod]
  );

  const markCodCollected = useCallback(
    (orderId) =>
      withBusy(async () => {
        try {
          await riderCodCollected(orderId, token);
          await refresh();
        } catch (err) {
          setHelpNotice(err.message);
        }
      }),
    [token, withBusy, refresh]
  );

  const markUndelivered = useCallback(
    (orderId, reason) =>
      withBusy(async () => {
        try {
          const data = await riderUndelivered(orderId, reason || "Customer not available", token);
          setTrip(data);
        } catch (err) {
          setHelpNotice(err.message);
        }
      }),
    [token, withBusy]
  );

  const reportKitchenDelay = useCallback(async () => {
    try {
      const res = await riderReport("kitchen_delay", token);
      setHelpNotice(res.notice);
    } catch (err) {
      setHelpNotice(err.message);
    }
  }, [token]);

  const reportAddressIssue = useCallback(
    async (orderId) => {
      try {
        const res = await riderReport("address_issue", token, orderId);
        setHelpNotice(res.notice);
      } catch (err) {
        setHelpNotice(err.message);
      }
    },
    [token]
  );

  const sos = useCallback(async () => {
    try {
      const res = await riderSos(token);
      setHelpNotice(res.notice);
    } catch (err) {
      setHelpNotice(err.message);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !shiftOn) {
      socketRef.current?.close();
      socketRef.current = null;
      return undefined;
    }
    let watchSubscription = null;
    let closed = false;
    const send = (coords) => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
            heading: coords.heading ?? 0,
          })
        );
      }
    };
    const startWatch = async () => {
      const { status } = await Location.requestForegroundPermissionAsync();
      if (status !== "granted") {
        setHelpNotice("Location permission is off — Homatri can't track your GPS. Enable it in Settings to go live.");
        return;
      }
      if (closed || !socketRef.current) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        send(pos.coords);
      } catch {
        /* best-effort first ping */
      }
      watchSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000 },
        (pos) => send(pos.coords)
      );
    };
    const ws = new WebSocket(riderLocationWsUrl(token));
    socketRef.current = ws;
    ws.onopen = () => startWatch();
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.timestamp) setLastGpsAt(msg.timestamp);
      } catch {
        /* ignore */
      }
    };
    return () => {
      closed = true;
      watchSubscription?.remove();
      ws.close();
      if (socketRef.current === ws) socketRef.current = null;
    };
  }, [token, shiftOn]);

  const value = useMemo(
    () => ({
      rider: trip?.rider || { fullName: "", vehicleNumber: "", phoneNumber: "" },
      kitchen: trip?.kitchen,
      windowInfo,
      shiftStatus: shiftOn ? "ON_SHIFT" : "OFF_SHIFT",
      machineState,
      pickupDone,
      stops,
      currentGroup,
      remainingStops,
      tiffinCount,
      loading,
      busy,
      helpNotice: helpNotice || (token ? null : "Sign in on Account to go on shift."),
      lastGpsAt,
      toggleShift,
      confirmPickup,
      markDelivered,
      confirmAllAtGate,
      markUndelivered,
      markCodCollected,
      reportKitchenDelay,
      reportAddressIssue,
      sos,
      refresh,
    }),
    [
      trip,
      windowInfo,
      shiftOn,
      machineState,
      pickupDone,
      stops,
      currentGroup,
      remainingStops,
      tiffinCount,
      loading,
      busy,
      helpNotice,
      lastGpsAt,
      toggleShift,
      confirmPickup,
      markDelivered,
      confirmAllAtGate,
      markUndelivered,
      markCodCollected,
      reportKitchenDelay,
      reportAddressIssue,
      sos,
      refresh,
      token,
    ]
  );

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}

export function useRider() {
  const context = useContext(RiderContext);
  if (!context) throw new Error("useRider must be used within RiderProvider");
  return context;
}
