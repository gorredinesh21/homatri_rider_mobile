import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { Fraunces_600SemiBold, Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { RiderProvider, useRider } from "./src/context/RiderContext";
import { mapsUrl } from "./src/lib/riderTrip";
import { loginMobileUser, registerMobileUser, submitRiderOnboarding } from "./src/services/api";
import { C, humanStatus } from "./src/theme";

const SESSION_KEY = "@homatri_rider_session";

const CLUSTERS = ["Ghansoli", "Vashi", "Airoli"];
const VEHICLES = ["SCOOTER", "BIKE", "EV"];
const UNDELIVERED_REASONS = ["Customer not available", "Wrong address", "Customer refused", "Food issue"];

export default function App() {
  const [session, setSession] = useState(null); // { token, phone } once restored
  const [restored, setRestored] = useState(false);
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) setSession({ token: parsed.token, phone: parsed.phone || "" });
        }
      })
      .catch(() => {})
      .finally(() => setRestored(true));
  }, []);

  const persistSession = useCallback((next) => {
    setSession(next);
    if (next) AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  }, []);

  if (!restored || !fontsLoaded) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.orange} size="large" />
      </View>
    );
  }

  return (
    <RiderProvider token={session?.token || null}>
      <RiderShell session={session} onSession={persistSession} />
    </RiderProvider>
  );
}

function RiderShell({ session, onSession }) {
  const [tab, setTab] = useState("SHIFT");
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>Homatri Rider</Text>
        <Text style={styles.sub}>Ghansoli fleet · 1 chef : 1 driver</Text>
      </View>
      {tab === "SHIFT" ? (
        <ShiftHome />
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 110 }}>
          <Account session={session} onSession={onSession} />
        </ScrollView>
      )}
      <View style={styles.tabBar}>
        {[
          ["SHIFT", "Shift"],
          ["ACCOUNT", "Account"],
        ].map(([key, label]) => (
          <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setTab(key)}>
            <Text style={tab === key ? styles.tabOn : styles.tabOff}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function ShiftHome() {
  const {
    rider,
    kitchen,
    windowInfo,
    shiftStatus,
    machineState,
    pickupDone,
    currentGroup,
    remainingStops,
    tiffinCount,
    stops,
    helpNotice,
    lastGpsAt,
    loading,
    busy,
    refresh,
    toggleShift,
    confirmPickup,
    markDelivered,
    confirmAllAtGate,
    markUndelivered,
    reportKitchenDelay,
    reportAddressIssue,
    sos,
  } = useRider();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      /* notice handled in context */
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const onSos = useCallback(() => {
    Alert.alert("Send SOS?", "This alerts the Homatri ops team with your last GPS location.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send SOS", style: "destructive", onPress: () => sos() },
    ]);
  }, [sos]);

  const onShift = shiftStatus === "ON_SHIFT";
  const nextStop = currentGroup[0] || null;
  const isGate = currentGroup.length > 1;
  const closed = stops.filter((s) => s.status !== "PENDING").length;

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.orange} size="large" />
          <Text style={styles.muted}>Loading your trip…</Text>
        </View>
      ) : null}

      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Homatri Rider</Text>
          <Text style={styles.h1}>{rider.fullName}</Text>
          <Text style={styles.muted}>{rider.vehicleNumber}</Text>
        </View>
        <TouchableOpacity
          onPress={toggleShift}
          style={[styles.shiftBtn, onShift ? styles.shiftOn : styles.shiftOff]}
        >
          <Text style={[styles.shiftText, onShift && { color: C.white }]}>
            {onShift ? "On shift" : "Off shift"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.state}>State · {machineState.replace(/_/g, " ")}</Text>

      {onShift ? (
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Active trip · 1 chef : 1 driver</Text>
          <Text style={styles.heroTitle}>{kitchen?.kitchenName}</Text>
          <Text style={styles.heroMuted}>
            {windowInfo.label} · {remainingStops} stops · {tiffinCount} tiffins
          </Text>
          <Text style={styles.heroMuted}>
            {lastGpsAt
              ? `GPS ping ${new Date(lastGpsAt).toLocaleTimeString()}`
              : "GPS every 10s while on shift"}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.h2}>Go on shift</Text>
          <Text style={styles.muted}>
            After the {windowInfo.cutoffTime} cutoff, this kitchen batch is assigned to you. Pickup stays locked until
            you confirm at the homemaker.
          </Text>
        </View>
      )}

      {helpNotice ? <Text style={styles.notice}>{helpNotice}</Text> : null}

      {onShift && !pickupDone ? (
        <PickupConfirmation kitchen={kitchen} mealWindow={windowInfo.mealWindow} onConfirm={confirmPickup} busy={busy} />
      ) : null}

      {onShift && pickupDone && machineState !== "BATCH_COMPLETED" ? (
        isGate ? (
          <GateDeliveryCard
            orders={currentGroup}
            onConfirmAll={confirmAllAtGate}
            onMarkUndelivered={markUndelivered}
            busy={busy}
          />
        ) : (
          <LegNavigationCard
            stop={nextStop}
            remainingStops={Math.max(0, remainingStops - 1)}
            onMarkDelivered={markDelivered}
            onReportAddressIssue={reportAddressIssue}
            busy={busy}
          />
        )
      ) : null}

      {machineState === "BATCH_COMPLETED" ? (
        <View style={[styles.card, styles.cardDone]}>
          <Text style={styles.h2}>Batch complete</Text>
          <Text style={styles.muted}>
            All assigned deliveries are closed. You can stay on shift for the next window or go off shift.
          </Text>
        </View>
      ) : null}

      {onShift ? (
        <View style={styles.row}>
          <Btn label="Report kitchen delay" onPress={reportKitchenDelay} />
          <Btn label="Report address issue" onPress={reportAddressIssue} />
          <Btn label="SOS" color={C.danger} onPress={onSos} />
        </View>
      ) : null}

      {onShift ? (
        <Text style={styles.muted}>
          This screen never lists future stops: {closed} closed / {stops.length} assigned.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function CodBadge({ order }) {
  const method = order?.paymentMethod ?? order?.payment_method;
  const status = order?.paymentStatus ?? order?.payment_status;
  if (method !== "COD") return null;
  if (status === "COD_COLLECTED") {
    return <Text style={styles.codCollected}>Cash collected ✓</Text>;
  }
  if (status === "COD_PENDING") {
    const amount = order?.amountToCollect ?? order?.amount_to_collect;
    return (
      <Text style={styles.codPending}>
        💵 Collect {amount != null ? `₹${amount}` : "cash"} — Cash on delivery
      </Text>
    );
  }
  return null;
}

function PickupConfirmation({ kitchen, mealWindow, onConfirm, busy }) {
  if (!kitchen) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Kitchen pickup</Text>
      <Text style={styles.h2}>{kitchen.kitchenName}</Text>
      <Text style={styles.muted}>
        {kitchen.chefName} · {kitchen.address}
      </Text>
      <Text style={styles.p}>1 chef : 1 driver for {mealWindow}</Text>
      <Btn label="Navigate to kitchen" color={C.dark} onPress={() => Linking.openURL(mapsUrl(kitchen))} />
      <Btn label="Confirm kitchen pickup" onPress={onConfirm} disabled={busy} />
    </View>
  );
}

function GateDeliveryCard({ orders, onConfirmAll, onMarkUndelivered, busy }) {
  const pending = orders.filter((order) => order.status === "PENDING");
  const [undeliveredIds, setUndeliveredIds] = useState(new Set());
  const [reasons, setReasons] = useState({});
  const [pins, setPins] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const sample = pending[0] || orders[0];
  const deliverIds = useMemo(
    () => pending.filter((order) => !undeliveredIds.has(order.orderId)).map((order) => order.orderId),
    [pending, undeliveredIds]
  );

  const toggleException = (orderId) => {
    setUndeliveredIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const submit = async () => {
    if (submitting || busy) return;
    setSubmitting(true);
    try {
      for (const orderId of undeliveredIds) {
        await onMarkUndelivered?.(orderId, reasons[orderId] || "Customer not available");
      }
      if (deliverIds.length) {
        await onConfirmAll?.(deliverIds.map((orderId) => ({ order_id: orderId, otp: pins[orderId] })));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!orders.length) return null;
  const inFlight = submitting || busy;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Gate drop-off</Text>
      <Text style={styles.h2}>
        Stop #{sample?.stopNumber}: {sample?.address}
      </Text>
      <Text style={styles.muted}>{pending.length} tiffins at this residential gate</Text>
      <Btn label="Open Google Maps navigation" color={C.dark} onPress={() => Linking.openURL(mapsUrl(sample))} />
      {orders.map((order) => (
        <View key={order.orderId} style={styles.inner}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.strong}>{order.customerName}</Text>
              <Text style={styles.muted}>Order {order.orderId}</Text>
            </View>
            <Text style={styles.chip}>{humanStatus(order.status)}</Text>
          </View>
          <CodBadge order={order} />
          {order.status === "PENDING" ? (
            <>
              <TextInput
                value={pins[order.orderId] || ""}
                onChangeText={(v) => setPins((p) => ({ ...p, [order.orderId]: v.replace(/\D/g, "").slice(0, 4) }))}
                placeholder="4-digit PIN"
                keyboardType="number-pad"
                style={styles.input}
              />
              <TouchableOpacity onPress={() => toggleException(order.orderId)}>
                <Text style={styles.orange}>
                  {undeliveredIds.has(order.orderId) ? "☑" : "☐"} Mark undelivered
                </Text>
              </TouchableOpacity>
              {undeliveredIds.has(order.orderId) ? (
                <View style={styles.reasonPicker}>
                  {UNDELIVERED_REASONS.map((reason) => (
                    <Pill
                      key={reason}
                      label={reason}
                      active={(reasons[order.orderId] || "Customer not available") === reason}
                      onPress={() => setReasons((r) => ({ ...r, [order.orderId]: reason }))}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ))}
      <Btn
        label={inFlight ? "Confirming…" : "Confirm all deliveries at this address"}
        color={C.green}
        disabled={pending.length === 0 || inFlight}
        onPress={submit}
      />
      <Text style={styles.muted}>
        Exceptions stay UNDELIVERED. Everyone else at the gate still completes as DELIVERED.
      </Text>
    </View>
  );
}

function LegNavigationCard({ stop, remainingStops, onMarkDelivered, onReportAddressIssue, busy }) {
  const [pin, setPin] = useState("");
  if (!stop) {
    return (
      <Text style={styles.muted}>
        No next stop. The route stays stored on the server; this screen only shows the immediate leg.
      </Text>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Next stop only</Text>
      <Text style={styles.h2}>
        Stop #{stop.stopNumber}: {stop.customerName}
      </Text>
      <Text style={styles.p}>{stop.address}</Text>
      <Text style={styles.muted}>
        {remainingStops} stop{remainingStops === 1 ? "" : "s"} remaining after this gate
      </Text>
      <CodBadge order={stop} />
      <View style={styles.row}>
        <Btn label="Open Google Maps" color={C.dark} onPress={() => Linking.openURL(mapsUrl(stop))} />
        <Btn
          label="Call customer"
          onPress={() => Linking.openURL(`tel:${stop.customerPhone || ""}`)}
        />
      </View>
      <Field label="Delivery PIN" value={pin} onChange={setPin} keyboard="number-pad" />
      <Btn label="Mark delivered" color={C.green} onPress={() => onMarkDelivered(stop.orderId, pin)} disabled={busy} />
      <TouchableOpacity onPress={() => onReportAddressIssue(stop.orderId)} disabled={busy}>
        <Text style={styles.muted}>Report address issue</Text>
      </TouchableOpacity>
    </View>
  );
}

function Account({ session, onSession }) {
  const [mode, setMode] = useState("LOG_IN");
  const [phone, setPhone] = useState(session?.phone || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const token = session?.token || null;

  if (showOnboarding) {
    return <Onboarding phone={phone} token={token} onClose={() => setShowOnboarding(false)} />;
  }

  const logout = () => {
    onSession(null);
    setPassword("");
    Alert.alert("Logged out", "Your session was cleared from this device.");
  };

  return (
    <View>
      <Text style={styles.kicker}>Account</Text>
      <Text style={styles.h1}>{mode === "SIGN_UP" ? "Create rider login" : "Welcome back"}</Text>
      <Field label="Phone" value={phone} onChange={setPhone} keyboard="phone-pad" />
      {mode === "SIGN_UP" ? <Field label="Email" value={email} onChange={setEmail} /> : null}
      <Field label="Password" value={password} onChange={setPassword} secure />
      {mode === "SIGN_UP" ? <Field label="Full name" value={name} onChange={setName} /> : null}
      <Btn
        label={mode === "SIGN_UP" ? "Sign up" : "Log in"}
        onPress={async () => {
          try {
            const res =
              mode === "SIGN_UP"
                ? await registerMobileUser({ phone, email, password, fullName: name })
                : await loginMobileUser({ phone, password });
            onSession({ token: res.access_token, phone });
            Alert.alert("Signed in", "Finish rider onboarding next.");
          } catch (e) {
            Alert.alert("Auth", e.message);
          }
        }}
      />
      <TouchableOpacity onPress={() => setMode(mode === "SIGN_UP" ? "LOG_IN" : "SIGN_UP")}>
        <Text style={styles.orange}>
          {mode === "SIGN_UP" ? "Already have an account? Log in" : "Need an account? Sign up"}
        </Text>
      </TouchableOpacity>
      {token ? <Text style={styles.ok}>Session active for +91 {session?.phone || phone}</Text> : null}
      <Btn label="Rider onboarding" onPress={() => setShowOnboarding(true)} />
      {token ? <Btn label="Log out" color={C.danger} onPress={logout} /> : null}
    </View>
  );
}

function Onboarding({ phone, token, onClose }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    driver_phone: phone || "",
    driver_name: "",
    driving_license_number: "",
    vehicle_type: "SCOOTER",
    vehicle_reg_number: "",
    assigned_cluster: "Ghansoli",
    payout_upi_id: "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <View>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.orange}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.kicker}>Rider onboarding</Text>
      <Text style={styles.h1}>Join the delivery fleet</Text>
      <Field label="Full legal name" value={form.driver_name} onChange={(v) => set("driver_name", v)} />
      <Field label="Phone number" value={form.driver_phone} onChange={(v) => set("driver_phone", v)} />
      <Field
        label="Driving license number"
        value={form.driving_license_number}
        onChange={(v) => set("driving_license_number", v)}
      />
      <Text style={styles.kicker}>Vehicle type</Text>
      <View style={styles.row}>
        {VEHICLES.map((v) => (
          <Pill key={v} label={v} active={form.vehicle_type === v} onPress={() => set("vehicle_type", v)} />
        ))}
      </View>
      <Field
        label="Vehicle registration"
        value={form.vehicle_reg_number}
        onChange={(v) => set("vehicle_reg_number", v.toUpperCase())}
      />
      <Text style={styles.kicker}>Service cluster</Text>
      <View style={styles.row}>
        {CLUSTERS.map((v) => (
          <Pill key={v} label={v} active={form.assigned_cluster === v} onPress={() => set("assigned_cluster", v)} />
        ))}
      </View>
      <Field label="Payout UPI ID" value={form.payout_upi_id} onChange={(v) => set("payout_upi_id", v)} />
      <Btn
        label={saving ? "Saving…" : "Finish rider setup"}
        disabled={saving}
        onPress={async () => {
          setSaving(true);
          try {
            await submitRiderOnboarding(
              {
                ...form,
                driver_phone: form.driver_phone.replace(/\D/g, "").slice(-10),
                vehicle_reg_number: form.vehicle_reg_number.toUpperCase(),
              },
              token
            );
            Alert.alert("You're on the Ghansoli roster", "Pickup slots will appear once a meal window batches.");
            onClose();
          } catch (e) {
            Alert.alert("Onboarding", e.message);
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}

function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillOn]}>
      <Text style={[styles.pillText, active && { color: C.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Btn({ label, onPress, color = C.orange, disabled }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChange, keyboard, secure }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.kicker}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={onChange}
        keyboardType={keyboard}
        secureTextEntry={secure}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: { backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.border },
  brand: { fontSize: 22, fontWeight: "bold", color: C.orange, fontStyle: "italic", fontFamily: "Fraunces_700Bold" },
  sub: { fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "Figtree_400Regular" },
  body: { flex: 1, padding: 16 },
  kicker: { fontSize: 11, fontWeight: "bold", color: C.orange, textTransform: "uppercase", letterSpacing: 1, marginTop: 8, fontFamily: "Figtree_700Bold" },
  h1: { fontSize: 26, fontWeight: "600", color: C.dark, marginTop: 4, fontFamily: "Fraunces_600SemiBold" },
  h2: { fontSize: 18, fontWeight: "600", color: C.dark, marginTop: 6, fontFamily: "Fraunces_600SemiBold" },
  muted: { fontSize: 13, color: C.muted, marginTop: 4, fontFamily: "Figtree_400Regular" },
  p: { fontSize: 13, color: C.dark, marginTop: 4, fontFamily: "Figtree_400Regular" },
  strong: { fontSize: 15, fontWeight: "bold", color: C.dark, fontFamily: "Figtree_600SemiBold" },
  orange: { color: C.orange, fontWeight: "bold", marginTop: 8, fontFamily: "Figtree_600SemiBold" },
  ok: { color: C.green, marginTop: 8, fontFamily: "Figtree_500Medium" },
  state: { fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginTop: 12, fontFamily: "Figtree_500Medium" },
  notice: {
    marginTop: 12,
    backgroundColor: C.orangeLight,
    borderWidth: 1,
    borderColor: "rgba(229,58,0,0.2)",
    borderRadius: 16,
    padding: 12,
    color: C.dark,
    fontSize: 13,
    fontFamily: "Figtree_400Regular",
  },
  hero: { backgroundColor: C.dark, borderRadius: 24, padding: 18, marginTop: 12 },
  heroKicker: { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Figtree_600SemiBold" },
  heroTitle: { color: C.white, fontSize: 22, fontWeight: "600", marginTop: 6, fontFamily: "Fraunces_600SemiBold" },
  heroMuted: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4, fontFamily: "Figtree_400Regular" },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginTop: 12 },
  cardDone: { borderColor: C.green, backgroundColor: C.greenLight },
  inner: { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 10, marginTop: 10 },
  codPending: { marginTop: 6, fontSize: 12, fontWeight: "bold", color: C.orangeDark, backgroundColor: C.orangeLight, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontFamily: "Figtree_600SemiBold" },
  codCollected: { marginTop: 6, fontSize: 12, fontWeight: "bold", color: C.green, backgroundColor: C.greenLight, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontFamily: "Figtree_600SemiBold" },
  reasonPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  shiftBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  shiftOn: { backgroundColor: C.green },
  shiftOff: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  shiftText: { fontWeight: "700", color: C.dark, fontSize: 13, fontFamily: "Figtree_700Bold" },
  pill: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  pillOn: { backgroundColor: C.orange, borderColor: C.orange },
  pillText: { fontSize: 12, fontWeight: "bold", color: C.dark, fontFamily: "Figtree_600SemiBold" },
  chip: { fontSize: 10, fontWeight: "bold", backgroundColor: C.cream, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, color: C.muted, fontFamily: "Figtree_700Bold" },
  btn: { marginTop: 10, paddingVertical: 12, borderRadius: 14, alignItems: "center", flex: 1, minWidth: 140 },
  btnText: { color: C.white, fontWeight: "bold", fontSize: 13, fontFamily: "Figtree_700Bold" },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, marginTop: 4, backgroundColor: C.cream, fontFamily: "Figtree_400Regular", color: C.dark },
  tabBar: { flexDirection: "row", backgroundColor: C.white, borderTopWidth: 1, borderColor: C.border, paddingVertical: 12 },
  tabItem: { flex: 1, alignItems: "center" },
  tabOn: { color: C.orange, fontWeight: "bold", fontSize: 12, fontFamily: "Figtree_700Bold" },
  tabOff: { color: C.muted, fontSize: 12, fontFamily: "Figtree_500Medium" },
});
