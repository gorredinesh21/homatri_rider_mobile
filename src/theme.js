export const C = {
  cream: "#FBF9F6",
  orange: "#E53A00",
  orangeDark: "#C43200",
  orangeLight: "#FFF1EC",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  dark: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  white: "#FFFFFF",
  danger: "#B42318",
};

export const HUMAN_STATUS = {
  PENDING: "Pending",
  DELIVERED: "Delivered",
  UNDELIVERED: "Undelivered",
  RAZORPAY: "Paid online",
  COD: "Cash on delivery",
  COD_PENDING: "Cash to collect",
  COD_COLLECTED: "Cash collected",
  PAID: "Paid",
};

export function humanStatus(value) {
  if (value == null) return "";
  return HUMAN_STATUS[value] || value.replace(/_/g, " ").toLowerCase().replace(/^./, (ch) => ch.toUpperCase());
}
