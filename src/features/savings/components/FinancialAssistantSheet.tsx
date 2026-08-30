import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { Spacing } from '@shared/constants/theme';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { executeFinancialPlan, type ActionResult } from '../assistant/executeFinancialPlan';
import {
  parseClientFinancialPlan,
  type FinancialAction,
  type FinancialPlan,
} from '../assistant/financialPlan';
import { MOVIMIENTO_CATEGORIAS, useMovimientosStore } from '../store/useMovimientosStore';
import { useSavingsStore } from '../store/useSavingsStore';
import { GOAL_CATEGORIES, GOAL_ICON_IDS } from '../domain/savings';

type Props = {
  visible: boolean;
  plan: FinancialPlan | null;
  onChange: (plan: FinancialPlan) => void;
  onClose: () => void;
};

const MONEY_FIELDS = ['monto', 'amount', 'targetAmount'] as const;
const TEXT_FIELDS = ['descripcion', 'description', 'title'] as const;
const DATE_FIELDS = ['fecha', 'deadline', 'desde', 'hasta'] as const;

function actionName(action: FinancialAction): string {
  const payload = action.payload as Record<string, unknown>;
  return String(
    payload.descripcion ??
      payload.description ??
      payload.title ??
      action.resourceId ??
      action.domain
  );
}

function actionTitle(action: FinancialAction): string {
  return `${action.operation} ${action.domain} ${actionName(action)}`;
}

function DateInput({
  value,
  label,
  onCommit,
  color,
  borderColor,
  placeholderColor,
}: {
  value?: number;
  label: string;
  onCommit: (value: string) => void;
  color: string;
  borderColor: string;
  placeholderColor: string;
}) {
  const [text, setText] = useState(
    value && value > 0 ? new Date(value).toISOString().slice(0, 10) : ''
  );
  useEffect(() => {
    setText(value && value > 0 ? new Date(value).toISOString().slice(0, 10) : '');
  }, [value]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => onCommit(text)}
      keyboardType="numbers-and-punctuation"
      maxLength={10}
      accessibilityLabel={label}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={placeholderColor}
      style={[styles.input, { color, borderColor }]}
    />
  );
}

function querySummary(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const values = Object.values(data as Record<string, unknown>).flatMap((value) =>
    Array.isArray(value) ? value : [value]
  );
  const lines = values.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const name = item.title ?? item.descripcion ?? item.description;
    const amount = item.monto ?? item.amount ?? item.targetAmount ?? item.total;
    if (name === undefined && amount === undefined) return [];
    return [
      `${name ?? ''}${name !== undefined && amount !== undefined ? ': ' : ''}${amount ?? ''}`,
    ];
  });
  return lines.length ? lines.join('\n') : null;
}

export default function FinancialAssistantSheet({ visible, plan, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const movements = useMovimientosStore((state) => state.movimientos);
  const createExpense = useMovimientosStore((state) => state.createExpense);
  const updateExpense = useMovimientosStore((state) => state.updateExpense);
  const deleteExpense = useMovimientosStore((state) => state.deleteExpense);
  const goals = useSavingsStore((state) => state.goals);
  const operations = useSavingsStore((state) => state.operations);
  const createGoal = useSavingsStore((state) => state.createGoal);
  const updateGoal = useSavingsStore((state) => state.updateGoal);
  const deleteGoal = useSavingsStore((state) => state.deleteGoal);
  const createOperation = useSavingsStore((state) => state.createOperation);
  const updateOperation = useSavingsStore((state) => state.updateOperation);
  const deleteOperation = useSavingsStore((state) => state.deleteOperation);
  const projection = useSavingsStore((state) => state.projection);
  const [draft, setDraft] = useState<FinancialPlan | null>(plan);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(plan);
      setResults(null);
    }
  }, [plan, visible]);

  const valid = useMemo(() => {
    if (!draft?.actions.length || draft.actions.some((action) => action.needsInput.length))
      return false;
    try {
      parseClientFinancialPlan({ actions: draft.actions });
      return true;
    } catch {
      return false;
    }
  }, [draft]);

  const changeActions = (actions: FinancialAction[]) => {
    if (!draft) return;
    const next = { ...draft, actions };
    setDraft(next);
    setResults(null);
    onChange(next);
  };

  const updatePayload = (index: number, field: string, value: string | number) => {
    if (!draft) return;
    changeActions(
      draft.actions.map((action, current) =>
        current === index
          ? {
              ...action,
              payload: { ...action.payload, [field]: value },
              needsInput: action.needsInput.filter((item) => item !== field),
            }
          : action
      )
    );
  };

  const selectResource = (index: number, resourceId: string) => {
    if (!draft) return;
    changeActions(
      draft.actions.map((action, current) =>
        current === index
          ? {
              ...action,
              resourceId,
              needsInput: action.needsInput.filter((item) => item !== 'resourceId'),
            }
          : action
      )
    );
  };

  const updateDate = (index: number, field: string, value: string) => {
    const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? Date.parse(`${value}T00:00:00Z`)
      : Number.NaN;
    if (Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value) {
      updatePayload(index, field, timestamp);
      return;
    }
    if (!draft) return;
    changeActions(
      draft.actions.map((action, current) => {
        if (current !== index) return action;
        const payload = { ...action.payload } as Record<string, unknown>;
        delete payload[field];
        return {
          ...action,
          payload,
          needsInput: [...new Set([...action.needsInput, field])],
        };
      })
    );
  };

  const confirm = async () => {
    if (!draft || !valid) return;
    setExecuting(true);
    try {
      const parsed = parseClientFinancialPlan({ actions: draft.actions });
      const nextResults = await executeFinancialPlan(parsed.actions, {
        movements,
        goals,
        operations,
        createExpense,
        updateExpense,
        deleteExpense,
        createGoal,
        updateGoal,
        deleteGoal,
        createOperation,
        updateOperation,
        deleteOperation,
        projection,
      });
      setResults(nextResults);
    } finally {
      setExecuting(false);
    }
  };

  if (!draft) return null;

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('financialAssistant.title')}
      subtitle={t('financialAssistant.subtitle')}
    >
      <Text style={[styles.count, { color: colors.text.secondary }]}>
        {t('financialAssistant.actionCount', { count: draft.actions.length })}
      </Text>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {draft.actions.map((action, index) => {
          const payload = action.payload as Record<string, unknown>;
          const name = actionName(action);
          const result = results?.find((item) => item.actionId === action.actionId);
          const resources =
            action.domain === 'meta'
              ? goals
              : action.domain === 'ahorro'
                ? operations
                : [...movements, ...operations];
          return (
            <View
              key={action.actionId}
              style={[
                styles.card,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                  {actionTitle(action)}
                </Text>
                {!results ? (
                  <TouchableOpacity
                    onPress={() => changeActions(draft.actions.filter((_, item) => item !== index))}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${name}`}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.text.tertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {!results &&
                MONEY_FIELDS.map((field) =>
                  typeof payload[field] === 'number' || action.needsInput.includes(field) ? (
                    <TextInput
                      key={field}
                      value={
                        typeof payload[field] === 'number'
                          ? formatMoneyInputThousands(String(payload[field]))
                          : ''
                      }
                      onChangeText={(text) =>
                        updatePayload(index, field, parseMoneyAmountInt(text) || 0)
                      }
                      keyboardType="numeric"
                      maxLength={15}
                      accessibilityLabel={`${t(`financialAssistant.fields.${field}`)} de ${name}`}
                      placeholder={t(`financialAssistant.fields.${field}`)}
                      placeholderTextColor={colors.text.tertiary}
                      style={[
                        styles.input,
                        { color: colors.text.primary, borderColor: colors.materials.border },
                      ]}
                    />
                  ) : null
                )}

              {!results &&
                TEXT_FIELDS.map((field) =>
                  typeof payload[field] === 'string' || action.needsInput.includes(field) ? (
                    <TextInput
                      key={field}
                      value={typeof payload[field] === 'string' ? String(payload[field]) : ''}
                      onChangeText={(text) => updatePayload(index, field, text.slice(0, 140))}
                      maxLength={140}
                      accessibilityLabel={`${t(`financialAssistant.fields.${field}`)} de ${name}`}
                      placeholder={t(`financialAssistant.fields.${field}`)}
                      placeholderTextColor={colors.text.tertiary}
                      style={[
                        styles.input,
                        { color: colors.text.primary, borderColor: colors.materials.border },
                      ]}
                    />
                  ) : null
                )}

              {!results &&
                DATE_FIELDS.map((field) =>
                  typeof payload[field] === 'number' || action.needsInput.includes(field) ? (
                    <DateInput
                      key={field}
                      value={typeof payload[field] === 'number' ? payload[field] : undefined}
                      onCommit={(text) => updateDate(index, field, text)}
                      label={`${t(`financialAssistant.fields.${field}`)} de ${name}`}
                      color={colors.text.primary}
                      borderColor={colors.materials.border}
                      placeholderColor={colors.text.tertiary}
                    />
                  ) : null
                )}

              {!results && (payload.tipo || action.needsInput.includes('tipo')) ? (
                <View style={styles.chips} accessibilityLabel={t('financialAssistant.fields.tipo')}>
                  {(['gasto', 'ahorro'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => updatePayload(index, 'tipo', type)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: payload.tipo === type }}
                      style={[
                        styles.chip,
                        { borderColor: colors.materials.border },
                        payload.tipo === type && { backgroundColor: colors.materials.highlight },
                      ]}
                    >
                      <Text style={{ color: colors.text.primary }}>
                        {t(`financialAssistant.values.${type}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {!results && (payload.type || action.needsInput.includes('type')) ? (
                <View style={styles.chips} accessibilityLabel={t('financialAssistant.fields.type')}>
                  {(['aporte', 'retiro'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => updatePayload(index, 'type', type)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: payload.type === type }}
                      style={[
                        styles.chip,
                        { borderColor: colors.materials.border },
                        payload.type === type && { backgroundColor: colors.materials.highlight },
                      ]}
                    >
                      <Text style={{ color: colors.text.primary }}>
                        {t(`financialAssistant.values.${type}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {!results &&
              action.domain === 'movimiento' &&
              (payload.categoria || action.needsInput.includes('categoria')) ? (
                <View
                  style={styles.chips}
                  accessibilityLabel={t('financialAssistant.fields.categoria')}
                >
                  {MOVIMIENTO_CATEGORIAS.map((category) => (
                    <TouchableOpacity
                      key={category}
                      onPress={() => updatePayload(index, 'categoria', category)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: payload.categoria === category }}
                      style={[
                        styles.chip,
                        { borderColor: colors.materials.border },
                        payload.categoria === category && {
                          backgroundColor: colors.materials.highlight,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.text.primary }}>
                        {t(`movimientos.categorias.${category}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {!results &&
              action.domain === 'meta' &&
              (payload.category || action.needsInput.includes('category')) ? (
                <View
                  style={styles.chips}
                  accessibilityLabel={t('financialAssistant.fields.category')}
                >
                  {GOAL_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      onPress={() => updatePayload(index, 'category', category)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: payload.category === category }}
                      style={[
                        styles.chip,
                        { borderColor: colors.materials.border },
                        payload.category === category && {
                          backgroundColor: colors.materials.highlight,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.text.primary }}>
                        {t(`financialAssistant.values.${category}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {!results &&
              action.domain === 'meta' &&
              (payload.iconId || action.needsInput.includes('iconId')) ? (
                <View
                  style={styles.chips}
                  accessibilityLabel={t('financialAssistant.fields.iconId')}
                >
                  {GOAL_ICON_IDS.map((iconId) => (
                    <TouchableOpacity
                      key={iconId}
                      onPress={() => updatePayload(index, 'iconId', iconId)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: payload.iconId === iconId }}
                      style={[
                        styles.chip,
                        { borderColor: colors.materials.border },
                        payload.iconId === iconId && {
                          backgroundColor: colors.materials.highlight,
                        },
                      ]}
                    >
                      <Ionicons
                        name={iconId === 'book' ? 'book' : iconId === 'plane' ? 'airplane' : 'flag'}
                        size={18}
                        color={colors.text.primary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {!results && action.needsInput.includes('resourceId') ? (
                <View style={styles.chips}>
                  {resources.map((resource) => (
                    <TouchableOpacity
                      key={resource.id}
                      onPress={() => selectResource(index, resource.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('financialAssistant.selectResource')} ${'title' in resource ? resource.title : resource.id}`}
                      style={[styles.chip, { borderColor: colors.materials.border }]}
                    >
                      <Text style={{ color: colors.text.primary }}>
                        {'title' in resource ? resource.title : resource.id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {!results && action.needsInput.includes('goalId') ? (
                <View
                  style={styles.chips}
                  accessibilityLabel={t('financialAssistant.fields.goalId')}
                >
                  {goals.map((goal) => (
                    <TouchableOpacity
                      key={goal.id}
                      onPress={() => updatePayload(index, 'goalId', goal.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('financialAssistant.selectResource')} ${goal.title}`}
                      style={[styles.chip, { borderColor: colors.materials.border }]}
                    >
                      <Text style={{ color: colors.text.primary }}>{goal.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {action.needsInput.length ? (
                <Text style={[styles.pending, { color: colors.system.red }]}>
                  {t('financialAssistant.needsInput')}
                </Text>
              ) : null}
              {result ? (
                <View>
                  <Text
                    style={[
                      styles.result,
                      {
                        color:
                          result.status === 'success' ? colors.system.green : colors.system.red,
                      },
                    ]}
                  >
                    {t(
                      result.status === 'success'
                        ? 'financialAssistant.resultSuccess'
                        : 'financialAssistant.resultError'
                    )}
                  </Text>
                  {result.status === 'success' && querySummary(result.data) ? (
                    <Text style={[styles.queryResult, { color: colors.text.secondary }]}>
                      {querySummary(result.data)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      {!results ? (
        <CetiButton
          label={t('financialAssistant.confirm')}
          onPress={() => void confirm()}
          disabled={!valid}
          isLoading={executing}
        />
      ) : null}
      <CetiButton
        label={t(results ? 'financialAssistant.close' : 'financialAssistant.cancel')}
        onPress={onClose}
        variant="ghost"
      />
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  count: { ...Typography.subheadline, fontWeight: '700' },
  list: { maxHeight: 480 },
  card: { borderWidth: 1, borderRadius: 18, padding: Spacing.base, gap: 10, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...Typography.headline, flex: 1, textTransform: 'capitalize' },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  pending: { ...Typography.caption1, fontWeight: '700' },
  result: { ...Typography.subheadline, fontWeight: '800' },
  queryResult: { ...Typography.body, marginTop: 4 },
});
