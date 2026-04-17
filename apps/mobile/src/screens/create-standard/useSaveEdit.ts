import { useCallback, useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useStandards } from '../../hooks/useStandards';
import { MainStackParamList } from '../../navigation/types';
import { trackStandardEvent } from '../../utils/analytics';

export function useSaveEdit(
  parentNavigation: NativeStackNavigationProp<MainStackParamList> | undefined | null,
  mainNavigation: NativeStackNavigationProp<MainStackParamList>,
) {
  const editingStandardId = useStandardsBuilderStore((s) => s.editingStandardId);
  const generatePayload = useStandardsBuilderStore((s) => s.generatePayload);
  const { updateStandard, standards } = useStandards();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveEdit = useCallback(async () => {
    if (!editingStandardId) return;

    const payload = generatePayload();
    if (!payload) {
      setSaveError('Please complete all required fields.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { periodStartPreference: preference, summary: _summary, ...standardPayload } = payload;
    const original = standards.find((s) => s.id === editingStandardId);
    const clearPeriodStartPreference = !!original?.periodStartPreference && !preference;

    setSaving(true);
    setSaveError(null);
    try {
      await updateStandard({
        standardId: editingStandardId,
        ...standardPayload,
        periodStartPreference: preference,
        clearPeriodStartPreference,
      });
      trackStandardEvent('standard_edit', {
        standardId: editingStandardId,
        standardName: payload.name,
        cadence: payload.cadence,
      });
      if (parentNavigation) {
        parentNavigation.goBack();
      } else {
        mainNavigation.goBack();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editingStandardId, generatePayload, updateStandard, standards, parentNavigation, mainNavigation]);

  return { editingStandardId, handleSaveEdit, saving, saveError };
}
