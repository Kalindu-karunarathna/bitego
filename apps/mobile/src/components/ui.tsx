import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

// Small set of reusable building blocks so all screens look the same.
// Add new shared components here (or next to this file) instead of copying styles around.

export function Screen({ children, scroll = true, centered = false }: { children: ReactNode; scroll?: boolean; centered?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, centered && styles.centered]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex, centered && styles.centered]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: theme.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Banner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const bg = tone === "error" ? "#FDECEA" : tone === "warning" ? theme.warningSoft : theme.primarySoft;
  const fg = tone === "error" ? theme.danger : tone === "warning" ? theme.warning : theme.primaryDark;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
};

export function TextField({ label, error, optional, secure, multiline, ...rest }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={{ color: theme.muted, fontWeight: "400" }}>  (optional)</Text> : null}
      </Text>
      <TextInput
        value={rest.value}
        onChangeText={rest.onChangeText}
        placeholder={rest.placeholder}
        placeholderTextColor="#A0A09A"
        secureTextEntry={secure}
        keyboardType={rest.keyboardType}
        autoCapitalize={rest.autoCapitalize ?? "sentences"}
        autoCorrect={false}
        multiline={multiline}
        style={[styles.input, multiline && { height: 88, textAlignVertical: "top" }, !!error && { borderColor: theme.danger }]}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading = false,
  variant = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "link";
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: theme.primary },
        variant === "secondary" && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary },
        variant === "link" && { backgroundColor: "transparent", minHeight: 40 },
        isDisabled && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : theme.primary} />
      ) : (
        <Text style={[styles.buttonText, variant !== "primary" && { color: theme.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={{ color: selected ? "#fff" : theme.text, fontSize: 14 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const content = <View style={styles.card}>{children}</View>;
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={[styles.flex, styles.centered, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      {label ? <Text style={{ marginTop: 12, color: theme.muted }}>{label}</Text> : null}
    </View>
  );
}

export const Spacer = ({ size = theme.space.md }: { size?: number }) => <View style={{ height: size }} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xl * 2, gap: theme.space.sm },
  centered: { justifyContent: "center", alignItems: "stretch", flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "700", color: theme.text },
  heading: { fontSize: 18, fontWeight: "600", color: theme.text, marginTop: theme.space.md },
  body: { fontSize: 16, lineHeight: 22, color: theme.text },
  error: { color: theme.danger, fontSize: 13, marginTop: 4 },
  banner: { padding: theme.space.md, borderRadius: theme.radius },
  field: { gap: 4, marginTop: theme.space.sm },
  label: { fontSize: 14, fontWeight: "600", color: theme.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: theme.card,
    color: theme.text,
  },
  button: {
    minHeight: 50,
    borderRadius: theme.radius,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.lg,
    marginTop: theme.space.sm,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.space.md,
    gap: 4,
  },
});
