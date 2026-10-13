import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { Spacing } from '@shared/constants/theme';
import { Typography } from '@shared/constants/typography';
import { enterFadeUp, enterSoftFade, listExit, listLayout } from '@shared/constants/motion';
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
  /** "Dictar de nuevo": se llama dentro del onPress para conservar el gesto (iOS). */
  onRedictate?: () => void;
};

const MONEY_FIELDS = ['monto', 'amount', 'targetAmount'] as const;
const TEXT_FIELDS = ['descripcion', 'description', 'title'] as const;
const DATE_FIELDS = ['fecha', 'deadline', 'desde', 'hasta'] as const;

type TFn = (key: string, values?: Record<string, unknown>) => string;

type MovementLike = {
  tipo: 'gasto' | 'ahorro';
  monto?: number;
  descripcion?: string;
  categoria?: string;
  fecha?: number;
};

export type ReviewInfo = { title: string; destructive: boolean; lines: string[] };

export function formatCop(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${formatMoneyInputThousands(String(Math.round(Math.abs(value)))) || '0'}`;
}

/** Hoy / Ayer / "12 oct". Fechas en medianoche UTC se leen como día calendario. */
export function formatDay(value: unknown, t: TFn): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  const utcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  const day = utcMidnight
    ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return t('financialAssistant.review.today');
  if (diff === 1) return t('financialAssistant.review.yesterday');
  try {
    return day.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
  } catch {
    return day.toISOString().slice(0, 10);
  }
}

function describeAction(
  action: FinancialAction,
  t: TFn,
  data: {
    movements: {
      id: string;
      tipo: 'gasto' | 'ahorro';
      monto: number;
      descripcion: string;
      categoria: string;
      fecha?: number;
      createdAt: number;
    }[];
    operations: {
      id: string;
      type: 'aporte' | 'retiro';
      amount: number;
      description: string;
      fecha: number;
      goalId?: string;
    }[];
    goals: { id: string; title: string; targetAmount?: number; deadline?: number }[];
  }
): ReviewInfo {
  const p = action.payload as Record<string, unknown>;
  const lines: string[] = [];
  const add = (key: string, value: string | null | undefined) => {
    if (value) lines.push(t(`financialAssistant.review.${key}`, { value }));
  };
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
  const goalTitle = (id: unknown) =>
    typeof id === 'string' ? (data.goals.find((goal) => goal.id === id)?.title ?? null) : null;
  const title = (key: string, values?: Record<string, unknown>) =>
    t(`financialAssistant.review.${key}`, values).replace(/\s+/g, ' ').trim();
  const categoryLabel = (value: unknown) =>
    typeof value === 'string' ? t(`movimientos.categorias.${value}`) : null;
  const destructive = action.operation === 'eliminar';
  const range = () => {
    const from = formatDay(p.desde, t);
    const to = formatDay(p.hasta, t);
    if (from || to) add('range', [from, to].filter(Boolean).join(' – '));
  };

  if (action.domain === 'movimiento') {
    const movement = data.movements.find((item) => item.id === action.resourceId);
    const operation = data.operations.find((item) => item.id === action.resourceId);
    const target: MovementLike | undefined = movement
      ? { ...movement, fecha: movement.fecha ?? movement.createdAt }
      : operation
        ? {
            tipo: 'ahorro',
            monto: operation.amount,
            descripcion: operation.description,
            fecha: operation.fecha,
          }
        : undefined;
    const tipo = (target?.tipo ?? p.tipo) === 'ahorro' ? 'ahorro' : 'gasto';
    if (action.operation === 'crear') {
      add('amount', formatCop(p.monto));
      add('description', str(p.descripcion));
      if (tipo === 'gasto') add('category', categoryLabel(p.categoria));
      add('goal', goalTitle(p.goalId));
      add('date', formatDay(p.fecha, t) ?? t('financialAssistant.review.today'));
      return { title: title(tipo === 'ahorro' ? 'saving' : 'expense'), destructive, lines };
    }
    if (action.operation === 'consultar') {
      range();
      return {
        title: title(
          p.tipo === 'ahorro'
            ? 'querySavings'
            : p.tipo === 'gasto'
              ? 'queryExpenses'
              : 'queryMovements'
        ),
        destructive,
        lines,
      };
    }
    if (target) {
      add(
        'record',
        [target.descripcion, formatCop(target.monto), formatDay(target.fecha, t)]
          .filter(Boolean)
          .join(' · ')
      );
    } else {
      add('record', t('financialAssistant.review.notSelected'));
    }
    if (action.operation === 'editar') {
      add('newAmount', formatCop(p.monto));
      add('newDescription', str(p.descripcion));
      add('newCategory', categoryLabel(p.categoria));
      add('newDate', formatDay(p.fecha, t));
    }
    const verb = action.operation === 'editar' ? 'edit' : 'delete';
    return {
      title: title(`${verb}${tipo === 'ahorro' ? 'Saving' : 'Expense'}`),
      destructive,
      lines,
    };
  }

  if (action.domain === 'ahorro') {
    const operation = data.operations.find((item) => item.id === action.resourceId);
    const type = (operation?.type ?? p.type) === 'retiro' ? 'retiro' : 'aporte';
    if (action.operation === 'crear') {
      const goal = goalTitle(p.goalId);
      add('amount', formatCop(p.amount));
      add('description', str(p.description));
      add('date', formatDay(p.fecha, t) ?? t('financialAssistant.review.today'));
      const key = type === 'retiro' ? 'withdrawal' : 'contribution';
      return {
        title: goal ? title(key, { goal }) : title(`${key}NoGoal`),
        destructive,
        lines,
      };
    }
    if (action.operation === 'consultar') {
      range();
      add('goal', goalTitle(p.goalId));
      return { title: title('querySavings'), destructive, lines };
    }
    if (operation) {
      add(
        'record',
        [operation.description, formatCop(operation.amount), formatDay(operation.fecha, t)]
          .filter(Boolean)
          .join(' · ')
      );
      add('goal', goalTitle(operation.goalId));
    } else {
      add('record', t('financialAssistant.review.notSelected'));
    }
    if (action.operation === 'editar') {
      add('newAmount', formatCop(p.amount));
      add('newDescription', str(p.description));
      add('newDate', formatDay(p.fecha, t));
      add('goal', goalTitle(p.goalId));
    }
    const verb = action.operation === 'editar' ? 'edit' : 'delete';
    return {
      title: title(`${verb}${type === 'retiro' ? 'Withdrawal' : 'Contribution'}`),
      destructive,
      lines,
    };
  }

  // meta
  const goal = data.goals.find((item) => item.id === action.resourceId);
  if (action.operation === 'crear') {
    add('name', str(p.title));
    add('target', formatCop(p.targetAmount));
    add('deadline', formatDay(p.deadline, t));
    return { title: title('newGoal'), destructive, lines };
  }
  if (action.operation === 'consultar') {
    return {
      title: goal ? title('queryGoal', { goal: goal.title }) : title('queryGoals'),
      destructive,
      lines,
    };
  }
  if (action.operation === 'editar') {
    add('newName', str(p.title));
    add('newTarget', formatCop(p.targetAmount));
    add('newDeadline', formatDay(p.deadline, t));
    if (!goal) add('record', t('financialAssistant.review.notSelected'));
    return { title: title('editGoal', { goal: goal?.title ?? '' }), destructive, lines };
  }
  if (goal) add('target', formatCop(goal.targetAmount));
  else add('record', t('financialAssistant.review.notSelected'));
  return { title: title('deleteGoal', { goal: goal?.title ?? '' }), destructive, lines };
}

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

function querySummary(data: unknown, t: TFn): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const lines: string[] = [];
  let listed = false;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'projection') {
      const total = formatCop((value as { total?: unknown } | null)?.total);
      if (total) lines.push(t('financialAssistant.query.total', { value: total }));
      continue;
    }
    const items = Array.isArray(value) ? value : [value];
    if (Array.isArray(value)) listed = true;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const name = item.title ?? item.descripcion ?? item.description;
      const amount = formatCop(item.monto ?? item.amount ?? item.targetAmount ?? item.total);
      const day = formatDay(item.fecha, t);
      if (name === undefined && !amount) continue;
      const head = `${name ?? ''}${name !== undefined && amount ? ': ' : ''}${amount ?? ''}`;
      lines.push(day ? `${head} · ${day}` : head);
    }
  }
  if (!lines.length) return listed ? t('financialAssistant.query.empty') : null;
  return lines.slice(0, 20).join('\n');
}

export default function FinancialAssistantSheet({
  visible,
  plan,
  onChange,
  onClose,
  onRedictate,
}: Props) {
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
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(plan);
      setResults(null);
      setEditing(false);
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
      {draft.actions.length ? (
        <Text style={[styles.count, { color: colors.text.secondary }]}>
          {draft.actions.length === 1
            ? t('financialAssistant.actionCountOne')
            : t('financialAssistant.actionCount', { count: draft.actions.length })}
        </Text>
      ) : (
        <Text style={[styles.empty, { color: colors.text.secondary }]}>
          {t('financialAssistant.emptyPlan')}
        </Text>
      )}
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {draft.actions.map((action, index) => {
          const payload = action.payload as Record<string, unknown>;
          const name = actionName(action);
          const info = describeAction(action, t as TFn, { movements, operations, goals });
          const isSaving = action.domain === 'ahorro' || payload.tipo === 'ahorro';
          const goalId = typeof payload.goalId === 'string' ? payload.goalId : undefined;
          const result = results?.find((item) => item.actionId === action.actionId);
          const resources =
            action.domain === 'meta'
              ? goals
              : action.domain === 'ahorro'
                ? operations
                : [...movements, ...operations];
          return (
            <Animated.View
              key={action.actionId}
              entering={enterFadeUp(index, 60)}
              exiting={listExit}
              layout={listLayout}
              style={[
                styles.card,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
                info.destructive && { borderColor: colors.system.red, borderWidth: 2 },
              ]}
            >
              <View style={styles.cardHeader}>
                {info.destructive ? (
                  <Ionicons name="warning" size={20} color={colors.system.red} />
                ) : null}
                <Text
                  style={[
                    styles.cardTitle,
                    { color: info.destructive ? colors.system.red : colors.text.primary },
                  ]}
                >
                  {info.title}
                </Text>
                {editing && !results ? (
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

              {!editing && !results ? (
                <View style={styles.summary}>
                  {info.lines.map((line) => (
                    <Text key={line} style={[styles.summaryText, { color: colors.text.primary }]}>
                      {line}
                    </Text>
                  ))}
                  {info.destructive ? (
                    <Text style={[styles.pending, { color: colors.system.red }]}>
                      {t('financialAssistant.review.destructiveWarning')}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {editing &&
                !results &&
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

              {editing &&
                !results &&
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

              {editing &&
                !results &&
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

              {editing && !results && (payload.tipo || action.needsInput.includes('tipo')) ? (
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

              {editing && !results && (payload.type || action.needsInput.includes('type')) ? (
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

              {editing &&
              !results &&
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

              {editing &&
              !results &&
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

              {editing &&
              !results &&
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

              {editing && !results && action.needsInput.includes('resourceId') ? (
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

              {editing && !results && isSaving && action.operation === 'crear' ? (
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
                      style={[
                        styles.chip,
                        { borderColor: colors.materials.border },
                        goalId === goal.id && { backgroundColor: colors.materials.highlight },
                      ]}
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
                <Animated.View entering={enterSoftFade()}>
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
                  {result.status === 'success' &&
                  action.operation === 'consultar' &&
                  querySummary(result.data, t as TFn) ? (
                    <Text style={[styles.queryResult, { color: colors.text.secondary }]}>
                      {querySummary(result.data, t as TFn)}
                    </Text>
                  ) : null}
                </Animated.View>
              ) : null}
            </Animated.View>
          );
        })}
      </ScrollView>
      {!results ? (
        <View style={styles.actions}>
          {draft.actions.length ? (
            <CetiButton
              label={t('financialAssistant.confirm')}
              onPress={() => void confirm()}
              disabled={!valid}
              isLoading={executing}
            />
          ) : null}
          {!editing && draft.actions.length ? (
            <CetiButton
              label={t('financialAssistant.review.correct')}
              onPress={() => setEditing(true)}
              variant="glass"
            />
          ) : null}
          {onRedictate && !executing ? (
            <CetiButton
              label={t('financialAssistant.redictate')}
              onPress={onRedictate}
              variant="ghost"
            />
          ) : null}
        </View>
      ) : (
        <CetiButton label={t('financialAssistant.close')} onPress={onClose} variant="ghost" />
      )}
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  count: { ...Typography.subheadline, fontWeight: '700' },
  empty: { ...Typography.body, fontWeight: '600', paddingVertical: 12 },
  list: { maxHeight: 480 },
  card: { borderWidth: 1, borderRadius: 18, padding: Spacing.base, gap: 10, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...Typography.headline, flex: 1 },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summary: { gap: 4 },
  summaryText: { ...Typography.subheadline },
  actions: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  pending: { ...Typography.caption1, fontWeight: '700' },
  result: { ...Typography.subheadline, fontWeight: '800' },
  queryResult: { ...Typography.body, marginTop: 4 },
});
