import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { ReservationStatus, SellerListingDto } from "@bitego/shared";
import { ApiRequestError } from "@/api/client";
import { toFieldErrors } from "@/features/auth/formErrors";
import { color, shadow } from "./design";
import { Icon, type IconName } from "./Icon";

// The seller screens' building blocks, translated from the provider design prototype's CSS to React Native.

// ---------- Layout ----------

export function Page({
  children,
  header,
  footer,
  refreshing,
  onRefresh,
  padded = true,
  overlay,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  overlay?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={padded ? styles.content : styles.flushContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.primary} colors={[color.primary]} /> : undefined
          }
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
      {overlay}
    </SafeAreaView>
  );
}

// White top bar with a back button and a centred title (design: .page-header).
export function AppHeader({ title, action, onBack }: { title: string; action?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.appHeader}>
      <IconButton icon="back" label="Go back" onPress={onBack ?? (() => router.back())} bordered />
      <Text style={styles.appHeaderTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.appHeaderAction}>{action}</View>
    </View>
  );
}

// Big left-aligned title on a soft glow (design: .simple-header on the listings and reservations pages).
export function SimpleHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.simpleHeader}>
      <View style={styles.flex}>
        <Text style={styles.simpleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.simpleSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function TextLink({ title, onPress, icon }: { title: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={16} color={color.primary} /> : null}
      <Text style={styles.textLinkText}>{title}</Text>
    </Pressable>
  );
}

export function Surface({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (!onPress) return <View style={[styles.surface, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.surface, style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

// A white form section with an icon title (design: .form-block).
export function FormBlock({ icon, title, subtitle, children }: { icon?: IconName; title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.formBlock}>
      {title ? (
        <View style={styles.formBlockTitle}>
          {icon ? <View style={styles.formBlockIcon}><Icon name={icon} size={18} color={color.primary} /></View> : null}
          <View style={styles.flex}>
            <Text style={styles.formBlockHeading}>{title}</Text>
            {subtitle ? <Text style={styles.formBlockSub}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

// Linear gradient background drawn with react-native-svg (no extra package needed).
export function Gradient({
  stops,
  direction = "diagonal",
  style,
  children,
}: {
  stops: [string, number?][];
  direction?: "diagonal" | "horizontal" | "vertical";
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const end = direction === "horizontal" ? { x2: "1", y2: "0" } : direction === "vertical" ? { x2: "0", y2: "1" } : { x2: "1", y2: "1" };
  return (
    <View style={[styles.gradient, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" {...end}>
            {stops.map(([c, opacity], i) => (
              <Stop key={i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={c} stopOpacity={opacity ?? 1} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

// ---------- Buttons ----------

export function Btn({
  title,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  style,
  small = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "soft";
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const off = disabled || loading;
  const fg = variant === "primary" || variant === "danger" ? "#fff" : variant === "soft" ? color.error : color.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "danger" && styles.btnDanger,
        variant === "soft" && styles.btnSoft,
        off && styles.btnOff,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]}>{title}</Text>
          {iconRight ? <Icon name={iconRight} size={14} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  style,
  iconColor = color.text,
  size = 20,
  bordered = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  size?: number;
  bordered?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.iconBtn, bordered && styles.iconBtnBordered, style, pressed && styles.pressed]}>
      <Icon name={icon} size={size} color={iconColor} />
    </Pressable>
  );
}

// ---------- Forms ----------

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  optional,
  icon,
  keyboardType,
  autoCapitalize,
  multiline,
  disabled,
  prefix,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  optional?: boolean;
  icon?: IconName;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  disabled?: boolean;
  prefix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>
      <View style={[styles.inputWrap, multiline && styles.inputMulti, focused && styles.inputFocus, !!error && styles.inputError, disabled && styles.inputOff]}>
        {icon ? <Icon name={icon} size={18} color={color.muted} /> : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.muted2}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={false}
          multiline={multiline}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.inputMultiText]}
        />
      </View>
      <FieldError>{error}</FieldError>
    </View>
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <View style={styles.errorRow}>
      <Icon name="close" size={13} color={color.error} />
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <View style={styles.formError}>
      <Icon name="alert" size={16} color={color.error} />
      <Text style={styles.formErrorText}>{children}</Text>
    </View>
  );
}

// A tinted note with an icon (design: .form-hint, .deadline-note, .free-control).
export function Note({ icon, tone = "primary", title, text }: { icon: IconName; tone?: "primary" | "amber"; title?: string; text: string }) {
  const amber = tone === "amber";
  return (
    <View style={[styles.note, amber && styles.noteAmber]}>
      <Icon name={icon} size={17} color={amber ? color.warnText : color.primary} />
      <View style={styles.flex}>
        {title ? <Text style={[styles.noteTitle, amber && { color: color.warnText }]}>{title}</Text> : null}
        <Text style={[styles.noteText, amber && { color: color.warnText }, !!title && { color: color.muted }]}>{text}</Text>
      </View>
    </View>
  );
}

export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: { value: T; label: string; disabled?: boolean }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: o.disabled }}
              disabled={o.disabled}
              onPress={() => onChange(o.value)}
              style={[styles.chip, active && styles.chipActive, o.disabled && styles.chipOff]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <FieldError>{error}</FieldError>
    </View>
  );
}

export function Stepper({ value, onMinus, onPlus, minusDisabled, plusDisabled, label }: { value: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean; label: string }) {
  const button = (icon: IconName, onPress: () => void, off: boolean | undefined, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label}`}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, off && styles.btnOff, pressed && styles.pressed]}
    >
      <Icon name={icon} size={18} color={color.primary} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button("minus", onMinus, minusDisabled, "Decrease")}
      <Text style={styles.stepValue}>{value}</Text>
      {button("plus", onPlus, plusDisabled, "Increase")}
    </View>
  );
}

// ---------- Display ----------

// Rounded pill tabs with counts (design: .pill-tabs).
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.pillTabs}>
      {options.map((o) => {
        const active = o.value === value;
        const body = (
          <>
            {o.icon ? <Icon name={o.icon} size={15} color={active ? "#fff" : color.muted} /> : null}
            <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>{o.label}</Text>
            {o.count !== undefined ? (
              <View style={[styles.pillCount, active && styles.pillCountActive]}>
                <Text style={[styles.pillCountText, active && { color: color.primary }]}>{o.count}</Text>
              </View>
            ) : null}
          </>
        );
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)} style={styles.pillTab}>
            {active ? (
              <Gradient stops={[[color.mid], [color.primary]]} style={styles.pillActive}>{body}</Gradient>
            ) : (
              <View style={styles.pillInactive}>{body}</View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export type BadgeTone = "green" | "orange" | "gray" | "red";
const BADGE_COLORS: Record<BadgeTone, { bg: string; fg: string }> = {
  green: { bg: color.tint, fg: color.primary },
  orange: { bg: color.amberTint, fg: color.warnText },
  gray: { bg: color.surface2, fg: color.muted },
  red: { bg: color.errorTint, fg: color.error },
};

export function Badge({ label, tone = "green", icon, dot, upper = true, style }: { label: string; tone?: BadgeTone; icon?: IconName; dot?: boolean; upper?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = BADGE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: c.fg }]} /> : null}
      {icon ? <Icon name={icon} size={13} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }, !upper && styles.badgeTextPlain]}>{upper ? label.toUpperCase() : label}</Text>
    </View>
  );
}

// Listing state shown to the seller, like the design: Active, Limited (3 or fewer left), Sold out, Expired...
export const LIMITED_AT = 3;
export function listingState(listing: SellerListingDto): { label: string; tone: BadgeTone } {
  switch (listing.status) {
    case "ACTIVE":
      return listing.quantityAvailable <= LIMITED_AT ? { label: "Limited", tone: "orange" } : { label: "Active", tone: "green" };
    case "SOLD_OUT":
      return { label: "Sold out", tone: "gray" };
    case "COMPLETED":
      return { label: "Completed", tone: "gray" };
    case "EXPIRED":
      return { label: "Expired", tone: "gray" };
    default:
      return { label: "Cancelled", tone: "red" };
  }
}

const ORDER_BADGES: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  CONFIRMED: { label: "Ready for pickup", tone: "green" },
  PICKED_UP: { label: "Picked up", tone: "gray" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  EXPIRED: { label: "No-show", tone: "red" },
};
export const OrderBadge = ({ status, isNew }: { status: ReservationStatus; isNew?: boolean }) =>
  isNew && status === "CONFIRMED" ? <Badge label="New" tone="orange" /> : <Badge {...ORDER_BADGES[status]} />;

export function FoodImage({ uri, style }: { uri?: string | null; style: StyleProp<ViewStyle> }) {
  if (uri) return <Image source={{ uri }} accessibilityIgnoresInvertColors style={[styles.foodImage, style] as never} />;
  return (
    <View style={[styles.foodImage, styles.foodImageEmpty, style]}>
      <Icon name="food" size={26} color={color.light} />
    </View>
  );
}

export function InfoIcon({ icon, tone = "primary", size = 36 }: { icon: IconName; tone?: "primary" | "amber" | "red"; size?: number }) {
  const bg = tone === "amber" ? color.amberTint : tone === "red" ? color.errorTint : color.tint;
  const fg = tone === "amber" ? color.warnText : tone === "red" ? color.error : color.primary;
  return (
    <View style={[styles.infoIcon, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <View style={[styles.avatar, large && styles.avatarLarge]}>
      <Text style={styles.avatarText}>{name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"}</Text>
    </View>
  );
}

export function SuccessIcon({ size = 82 }: { size?: number }) {
  return (
    <View style={[styles.successRing, { width: size + 24, height: size + 24, borderRadius: (size + 24) / 2 }]}>
      <View style={[styles.successIcon, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name="check" size={Math.round(size * 0.48)} color="#fff" />
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} size={30} color={color.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action}
    </View>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View accessibilityLabel="Loading" style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View key={i} style={[styles.surface, styles.skeletonCard, { opacity }]}>
          <View style={styles.skeletonImage} />
          <View style={styles.flex}>
            <View style={[styles.skeletonLine, { width: "70%" }]} />
            <View style={[styles.skeletonLine, { width: "90%" }]} />
            <View style={[styles.skeletonLine, { width: "45%" }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState icon="alert" title="Something went wrong" text={message} action={<Btn title="Try again" variant="secondary" icon="refresh" onPress={onRetry} style={styles.emptyAction} />} />;
}

export function ConfirmDialog({
  visible,
  icon = "alert",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  busy,
  onConfirm,
  onClose,
  children,
  tone = "danger",
}: {
  visible: boolean;
  icon?: IconName;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
  tone?: "danger" | "primary";
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={[styles.dialogIcon, tone === "primary" && { backgroundColor: color.tint }]}>
            <Icon name={icon} size={26} color={tone === "primary" ? color.primary : color.error} />
          </View>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogText}>{message}</Text>
          {children}
          <View style={styles.dialogActions}>
            <Btn title={cancelLabel} variant="secondary" onPress={onClose} disabled={busy} style={styles.flex} />
            <Btn title={confirmLabel} variant={tone === "primary" ? "primary" : "danger"} onPress={onConfirm} loading={busy} style={styles.flex} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// A simple message with one button, used for features that are not available yet.
export function NoticeDialog({ visible, title, message, onClose, icon = "sparkles" }: { visible: boolean; title: string; message: string; onClose: () => void; icon?: IconName }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={[styles.dialogIcon, { backgroundColor: color.tint }]}><Icon name={icon} size={26} color={color.primary} /></View>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogText}>{message}</Text>
          <Btn title="OK" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// ---------- Data ----------

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please try again.";

// Field errors from an API validation failure, for showing next to each input.
export function apiFieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiRequestError && err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
    return toFieldErrors(err.details as { path: string; message: string }[]);
  }
  return {};
}

// Loads data whenever the screen comes into view, so lists are fresh after editing something.
export function useFocusData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const run = useCallback(async () => {
    const request = ++latest.current;
    try {
      const result = await load();
      if (request === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (request === latest.current) setError(errorMessage(err));
    } finally {
      if (request === latest.current) setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(useCallback(() => void run(), [run]));

  const refresh = useCallback(() => {
    setRefreshing(true);
    void run();
  }, [run]);

  const retry = useCallback(() => {
    setError(null);
    void run();
  }, [run]);

  return { data, setData, error, refreshing, refresh, retry };
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: color.page },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 40 },
  flushContent: { paddingBottom: 40 },
  footer: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line, paddingHorizontal: 18, paddingTop: 11, paddingBottom: 14, gap: 8 },
  pressed: { opacity: 0.8 },
  list: { gap: 12 },
  gradient: { overflow: "hidden" },

  appHeader: { height: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.softLine },
  appHeaderTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", letterSpacing: -0.35, color: color.text, marginHorizontal: 8 },
  appHeaderAction: { minWidth: 42, alignItems: "flex-end" },
  simpleHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14 },
  simpleTitle: { fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: color.text },
  simpleSubtitle: { fontSize: 13, color: color.muted, marginTop: 6 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: color.text },
  sectionSubtitle: { fontSize: 12, color: color.muted, marginTop: 4 },
  textLink: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6 },
  textLinkText: { fontSize: 13, fontWeight: "700", color: color.primary },
  surface: { backgroundColor: color.surface, borderRadius: 18, borderWidth: 1, borderColor: color.softLine, ...shadow },

  formBlock: { backgroundColor: color.surface, borderRadius: 19, borderWidth: 1, borderColor: color.softLine, padding: 16, marginBottom: 13 },
  formBlockTitle: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  formBlockIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: color.tint, alignItems: "center", justifyContent: "center" },
  formBlockHeading: { fontSize: 15, fontWeight: "800", color: color.text },
  formBlockSub: { fontSize: 12, color: color.muted, marginTop: 2 },

  btn: { minHeight: 50, borderRadius: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "transparent" },
  btnSmall: { minHeight: 42, borderRadius: 12, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: color.primary, shadowColor: color.primary, shadowOpacity: 0.22, shadowRadius: 9, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  btnSecondary: { backgroundColor: color.surface, borderColor: color.lineStrong },
  btnDanger: { backgroundColor: color.error },
  btnSoft: { backgroundColor: color.errorTint },
  btnOff: { opacity: 0.45 },
  btnPressed: { transform: [{ scale: 0.98 }] },
  btnText: { fontSize: 15, fontWeight: "700" },
  btnTextSmall: { fontSize: 13 },
  iconBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
  iconBtnBordered: { borderWidth: 1, borderColor: color.line },

  field: { gap: 7, marginTop: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13, fontWeight: "700", color: color.label },
  optional: { fontSize: 11, color: color.muted },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: color.line, backgroundColor: color.page },
  inputMulti: { minHeight: 96, alignItems: "flex-start", paddingVertical: 10 },
  inputFocus: { borderColor: color.mid, backgroundColor: color.surface },
  inputError: { borderColor: color.error },
  inputOff: { backgroundColor: color.surface2 },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: color.text, paddingVertical: 8 },
  inputMultiText: { minHeight: 76, textAlignVertical: "top", paddingVertical: 0 },
  prefix: { fontSize: 15, fontWeight: "700", color: color.muted },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  errorText: { flex: 1, fontSize: 12, color: color.error, fontWeight: "500" },
  formError: { flexDirection: "row", gap: 7, alignItems: "center", padding: 12, borderRadius: 11, backgroundColor: color.errorTint },
  formErrorText: { flex: 1, fontSize: 13, lineHeight: 18, color: color.error },
  note: { flexDirection: "row", gap: 9, alignItems: "flex-start", padding: 12, borderRadius: 12, backgroundColor: color.tintSoft, marginTop: 12 },
  noteAmber: { backgroundColor: color.amberSoft },
  noteTitle: { fontSize: 13, fontWeight: "700", color: color.primary, marginBottom: 2 },
  noteText: { fontSize: 12, lineHeight: 17, color: color.primary },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  chipActive: { backgroundColor: color.primary, borderColor: color.primary },
  chipOff: { opacity: 0.4 },
  chipText: { fontSize: 13, fontWeight: "600", color: color.text },
  chipTextActive: { color: "#fff" },

  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 76, textAlign: "center", fontSize: 14, fontWeight: "800", color: color.text },

  pillTabs: { flexDirection: "row", gap: 4, padding: 6, borderRadius: 99, backgroundColor: color.surface, ...shadow },
  pillTab: { flex: 1 },
  pillActive: { minHeight: 40, borderRadius: 99, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 6 },
  pillInactive: { minHeight: 40, borderRadius: 99, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 6 },
  pillText: { fontSize: 12, fontWeight: "700", color: color.muted, flexShrink: 1 },
  pillTextActive: { color: "#fff" },
  pillCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: color.surface2 },
  pillCountActive: { backgroundColor: "rgba(255,255,255,0.92)" },
  pillCountText: { fontSize: 10, fontWeight: "800", color: color.muted },

  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  badgeTextPlain: { fontSize: 11, letterSpacing: 0 },

  foodImage: { borderRadius: 12, backgroundColor: color.tintSoft },
  foodImageEmpty: { alignItems: "center", justifyContent: "center" },
  infoIcon: { borderRadius: 11, alignItems: "center", justifyContent: "center" },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: color.tint, alignItems: "center", justifyContent: "center" },
  avatarLarge: { width: 48, height: 48, borderRadius: 14 },
  avatarText: { fontSize: 13, fontWeight: "800", color: color.primary },
  successRing: { backgroundColor: color.tint, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  successIcon: { backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },

  empty: { alignItems: "center", paddingHorizontal: 22, paddingTop: 40, paddingBottom: 20, gap: 6 },
  emptyIcon: { width: 72, height: 72, borderRadius: 23, backgroundColor: color.tintSoft, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: color.text, textAlign: "center" },
  emptyText: { fontSize: 13, lineHeight: 19, color: color.muted, textAlign: "center" },
  emptyAction: { marginTop: 14, alignSelf: "stretch" },

  skeletonCard: { flexDirection: "row", gap: 12, padding: 10 },
  skeletonImage: { width: 96, height: 96, borderRadius: 12, backgroundColor: color.line },
  skeletonLine: { height: 10, borderRadius: 9, backgroundColor: color.line, marginTop: 12 },

  overlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.48)", alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { width: "100%", maxWidth: 390, backgroundColor: color.surface, borderRadius: 20, padding: 22, gap: 4 },
  dialogIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: color.errorTint, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12 },
  dialogTitle: { fontSize: 18, fontWeight: "800", color: color.text, textAlign: "center" },
  dialogText: { fontSize: 13, lineHeight: 19, color: color.muted, textAlign: "center", marginTop: 6, marginBottom: 14 },
  dialogActions: { flexDirection: "row", gap: 8, marginTop: 8 },
});
