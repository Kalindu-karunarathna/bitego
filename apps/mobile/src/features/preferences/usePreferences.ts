import { useCallback, useEffect, useState } from "react";
import type { UpdatePreferencesInput, UserPreferencesResponse } from "@bitego/shared";
import { fetchCategories, fetchPreferences, updatePreferences } from "@/api/preferences";

// Owner: Sachira. State and data hook for managing notification preferences.

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferencesResponse | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [prefData, catData] = await Promise.all([
        fetchPreferences(),
        fetchCategories().catch(() => []),
      ]);

      setPreferences(prefData);
      setCategories(catData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load preferences";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (input: UpdatePreferencesInput) => {
      try {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        const updated = await updatePreferences(input);
        setPreferences(updated);
        setSuccessMessage("Preferences saved successfully!");
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save preferences";
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return {
    preferences,
    categories,
    loading,
    saving,
    error,
    successMessage,
    load,
    save,
  };
}

