import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore, useProjectStore } from '@/src/stores';
import {
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
} from '@/src/api/hooks';
import type { Subscription, SubscriptionCategory, BillingCycle } from '@/src/types';

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'one-time', label: 'One-time' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getBillingLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'monthly': return '/mo';
    case 'yearly': return '/yr';
    case 'quarterly': return '/qtr';
    case 'weekly': return '/wk';
    case 'one-time': return 'once';
    default: return '';
  }
}

function FaviconImage({ url, faviconUrl, name }: { url?: string; faviconUrl?: string; name: string }) {
  const [error, setError] = useState(false);

  const imageUrl = useMemo(() => {
    if (faviconUrl && !error) return faviconUrl;
    if (url) {
      try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch {
        return null;
      }
    }
    return null;
  }, [url, faviconUrl, error]);

  if (!imageUrl) {
    return (
      <View style={styles.fallbackIcon}>
        <Text style={styles.fallbackText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.favicon}
      onError={() => setError(true)}
    />
  );
}

interface SubscriptionFormData {
  name: string;
  url: string;
  monthlyCost: string;
  billingCycle: BillingCycle;
  currency: string;
  categoryId: string | null;
  notes: string;
  isActive: boolean;
}

const defaultFormData: SubscriptionFormData = {
  name: '',
  url: '',
  monthlyCost: '',
  billingCycle: 'monthly',
  currency: 'USD',
  categoryId: null,
  notes: '',
  isActive: true,
};

interface SubscriptionModalProps {
  visible: boolean;
  subscription: Subscription | null;
  categories: SubscriptionCategory[];
  workspaceId: string;
  onClose: () => void;
  onSave: (data: SubscriptionFormData) => void;
  onDelete?: (subscription: Subscription) => void;
  isSaving: boolean;
}

function SubscriptionModal({
  visible,
  subscription,
  categories,
  workspaceId,
  onClose,
  onSave,
  onDelete,
  isSaving,
}: SubscriptionModalProps) {
  const [form, setForm] = useState<SubscriptionFormData>(defaultFormData);

  useEffect(() => {
    if (visible) {
      if (subscription) {
        setForm({
          name: subscription.name,
          url: subscription.url || '',
          monthlyCost: subscription.monthlyCost.toString(),
          billingCycle: subscription.billingCycle,
          currency: subscription.currency,
          categoryId: subscription.categoryId || null,
          notes: subscription.notes || '',
          isActive: subscription.isActive,
        });
      } else {
        setForm(defaultFormData);
      }
    }
  }, [subscription, visible]);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!form.monthlyCost || isNaN(parseFloat(form.monthlyCost))) {
      Alert.alert('Error', 'Valid cost is required');
      return;
    }
    onSave(form);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {subscription ? 'Edit Subscription' : 'New Subscription'}
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isSaving}>
            <Text style={[styles.modalSave, isSaving && styles.modalSaveDisabled]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Name *</Text>
            <TextInput
              style={styles.formInput}
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              placeholder="Netflix, Spotify, etc."
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {/* URL */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>URL</Text>
            <TextInput
              style={styles.formInput}
              value={form.url}
              onChangeText={(text) => setForm({ ...form, url: text })}
              placeholder="https://example.com"
              placeholderTextColor={colors.text.muted}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          {/* Cost Row */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.formLabel}>Cost *</Text>
              <TextInput
                style={styles.formInput}
                value={form.monthlyCost}
                onChangeText={(text) => setForm({ ...form, monthlyCost: text })}
                placeholder="9.99"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.formLabel}>Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipGroup}>
                  {CURRENCIES.map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[styles.chip, form.currency === curr && styles.chipSelected]}
                      onPress={() => setForm({ ...form, currency: curr })}
                    >
                      <Text style={[styles.chipText, form.currency === curr && styles.chipTextSelected]}>
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Billing Cycle */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Billing Cycle</Text>
            <View style={styles.chipGroup}>
              {BILLING_CYCLES.map((cycle) => (
                <TouchableOpacity
                  key={cycle.value}
                  style={[styles.chip, form.billingCycle === cycle.value && styles.chipSelected]}
                  onPress={() => setForm({ ...form, billingCycle: cycle.value })}
                >
                  <Text style={[styles.chipText, form.billingCycle === cycle.value && styles.chipTextSelected]}>
                    {cycle.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipGroup}>
                <TouchableOpacity
                  style={[styles.chip, form.categoryId === null && styles.chipSelected]}
                  onPress={() => setForm({ ...form, categoryId: null })}
                >
                  <Text style={[styles.chipText, form.categoryId === null && styles.chipTextSelected]}>
                    None
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      form.categoryId === cat.id && styles.chipSelected,
                      cat.color && { borderColor: cat.color },
                    ]}
                    onPress={() => setForm({ ...form, categoryId: cat.id })}
                  >
                    {cat.color && <View style={[styles.categoryDotSmall, { backgroundColor: cat.color }]} />}
                    <Text style={[styles.chipText, form.categoryId === cat.id && styles.chipTextSelected]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Notes</Text>
            <TextInput
              style={[styles.formInput, styles.formTextarea]}
              value={form.notes}
              onChangeText={(text) => setForm({ ...form, notes: text })}
              placeholder="Additional notes..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Active Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setForm({ ...form, isActive: !form.isActive })}
          >
            <Text style={styles.toggleLabel}>Active</Text>
            <View style={[styles.toggle, form.isActive && styles.toggleActive]}>
              <View style={[styles.toggleKnob, form.isActive && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* Delete Button - only show when editing */}
          {subscription && onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(subscription)}
              disabled={isSaving}
            >
              <FontAwesome name="trash" size={16} color={colors.accent.red} />
              <Text style={styles.deleteButtonText}>Delete Subscription</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
}: {
  subscription: Subscription;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const handlePress = () => {
    if (subscription.url) {
      Linking.openURL(subscription.url);
    }
  };

  const handleLongPress = () => {
    Alert.alert(
      subscription.name,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: onEdit },
        { text: 'Delete', onPress: onDelete, style: 'destructive' },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, !subscription.isActive && styles.cardInactive]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={!subscription.url && !onEdit}
      delayLongPress={500}
    >
      <FaviconImage
        url={subscription.url}
        faviconUrl={subscription.faviconUrl}
        name={subscription.name}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{subscription.name}</Text>
          {!subscription.isActive && (
            <View style={styles.inactiveTag}>
              <Text style={styles.inactiveTagText}>Inactive</Text>
            </View>
          )}
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.costText}>
            {formatCurrency(subscription.monthlyCost, subscription.currency)}
            <Text style={styles.cycleText}>{getBillingLabel(subscription.billingCycle)}</Text>
          </Text>
          {subscription.url && (
            <>
              <Text style={styles.separator}>|</Text>
              <Text style={styles.domainText} numberOfLines={1}>
                {new URL(subscription.url).hostname}
              </Text>
            </>
          )}
        </View>
        {subscription.notes && (
          <Text style={styles.notesText} numberOfLines={2}>{subscription.notes}</Text>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardActionButton} onPress={onEdit}>
          <FontAwesome name="pencil" size={14} color={colors.text.muted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function CategorySection({
  category,
  subscriptions,
  totalCost,
  onEditSubscription,
  onDeleteSubscription,
}: {
  category: SubscriptionCategory | null;
  subscriptions: Subscription[];
  totalCost: number;
  onEditSubscription: (sub: Subscription) => void;
  onDeleteSubscription: (sub: Subscription) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.sectionTitleRow}>
          {category?.color && (
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
          )}
          <Text style={styles.sectionTitle}>
            {category?.name || 'Uncategorized'}
          </Text>
          <Text style={styles.sectionCount}>({subscriptions.length})</Text>
        </View>
        <View style={styles.sectionRight}>
          <Text style={styles.sectionTotal}>{formatCurrency(totalCost, 'USD')}</Text>
          <FontAwesome
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.text.muted}
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sectionContent}>
          {subscriptions.map((sub, index) => (
            <SubscriptionCard
              key={`${sub.id}-${index}`}
              subscription={sub}
              onEdit={() => onEditSubscription(sub)}
              onDelete={() => onDeleteSubscription(sub)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function SubscriptionsScreen() {
  const connection = useConnectionStore((s) => s.connection);
  const isConnected = connection.status === 'connected';
  const { workspaces, selectedProject } = useProjectStore();

  // Get the workspace that contains the selected project
  const selectedWorkspace = useMemo(() => {
    if (!selectedProject) return workspaces[0] || null;
    return workspaces.find((ws) =>
      ws.projects.some((p) => p.id === selectedProject.id)
    ) || workspaces[0] || null;
  }, [workspaces, selectedProject]);

  const workspaceId = selectedWorkspace?.id || '';

  const { data, isLoading, error, refetch } = useSubscriptions(workspaceId || undefined);

  const createMutation = useCreateSubscription();
  const updateMutation = useUpdateSubscription();
  const deleteMutation = useDeleteSubscription();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAddSubscription = () => {
    setEditingSubscription(null);
    setModalVisible(true);
  };

  const handleEditSubscription = useCallback((subscription: Subscription) => {
    setEditingSubscription(subscription);
    setModalVisible(true);
  }, []);

  const handleDeleteSubscription = useCallback((subscription: Subscription) => {
    Alert.alert(
      'Delete Subscription',
      `Are you sure you want to delete "${subscription.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate({ id: subscription.id, workspaceId: subscription.workspaceId });
          },
        },
      ]
    );
  }, [deleteMutation]);

  const handleSaveSubscription = useCallback((formData: SubscriptionFormData) => {
    const cost = parseFloat(formData.monthlyCost);

    if (editingSubscription) {
      updateMutation.mutate(
        {
          id: editingSubscription.id,
          workspaceId: editingSubscription.workspaceId,
          input: {
            name: formData.name,
            url: formData.url || undefined,
            monthlyCost: cost,
            billingCycle: formData.billingCycle,
            currency: formData.currency,
            categoryId: formData.categoryId,
            notes: formData.notes || undefined,
            isActive: formData.isActive,
          },
        },
        {
          onSuccess: () => {
            setModalVisible(false);
            setEditingSubscription(null);
          },
        }
      );
    } else {
      if (!workspaceId) {
        Alert.alert('Error', 'Please select a workspace first');
        return;
      }
      createMutation.mutate(
        {
          workspaceId,
          name: formData.name,
          url: formData.url || undefined,
          monthlyCost: cost,
          billingCycle: formData.billingCycle,
          currency: formData.currency,
          categoryId: formData.categoryId || undefined,
          notes: formData.notes || undefined,
          isActive: formData.isActive,
        },
        {
          onSuccess: () => {
            setModalVisible(false);
          },
        }
      );
    }
  }, [editingSubscription, workspaceId, createMutation, updateMutation]);

  // Group subscriptions by category
  const groupedSubscriptions = useMemo(() => {
    if (!data) return [];

    const { subscriptions, categories } = data;
    const categoryMap = new Map<string | null, Subscription[]>();

    categoryMap.set(null, []);
    categories.forEach((c) => categoryMap.set(c.id, []));

    subscriptions
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((sub) => {
        const list = categoryMap.get(sub.categoryId || null) || categoryMap.get(null)!;
        list.push(sub);
      });

    const result: Array<{
      category: SubscriptionCategory | null;
      subscriptions: Subscription[];
      totalCost: number;
    }> = [];

    categories
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((category) => {
        const subs = categoryMap.get(category.id) || [];
        if (subs.length > 0) {
          result.push({
            category,
            subscriptions: subs,
            totalCost: subs.reduce((sum, s) => sum + s.monthlyCost, 0),
          });
        }
      });

    const uncategorized = categoryMap.get(null) || [];
    if (uncategorized.length > 0) {
      result.push({
        category: null,
        subscriptions: uncategorized,
        totalCost: uncategorized.reduce((sum, s) => sum + s.monthlyCost, 0),
      });
    }

    return result;
  }, [data]);

  // Calculate summary
  const summary = useMemo(() => {
    if (!data) return { totalMonthly: 0, activeCount: 0, inactiveCount: 0 };

    const active = data.subscriptions.filter((s) => s.isActive);
    const inactive = data.subscriptions.filter((s) => !s.isActive);
    const totalMonthly = active.reduce((sum, s) => {
      switch (s.billingCycle) {
        case 'yearly': return sum + s.monthlyCost / 12;
        case 'quarterly': return sum + s.monthlyCost / 3;
        case 'weekly': return sum + s.monthlyCost * 4.33;
        case 'one-time': return sum;
        default: return sum + s.monthlyCost;
      }
    }, 0);

    return { totalMonthly, activeCount: active.length, inactiveCount: inactive.length };
  }, [data]);

  // Not connected
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="plug" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Not Connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect to your desktop to view subscriptions
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="credit-card" size={48} color={colors.accent.purple} />
          </View>
          <Text style={styles.emptyTitle}>Loading Subscriptions...</Text>
        </View>
      </View>
    );
  }

  // Error
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, styles.errorIcon]}>
            <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
          </View>
          <Text style={styles.emptyTitle}>Error Loading Subscriptions</Text>
          <Text style={styles.emptySubtitle}>{(error as Error).message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <FontAwesome name="refresh" size={16} color={colors.text.primary} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty
  if (!data || data.subscriptions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="credit-card" size={48} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Subscriptions</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + button to add your first subscription
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddSubscription}>
            <FontAwesome name="plus" size={16} color="#fff" />
            <Text style={styles.addButtonText}>Add Subscription</Text>
          </TouchableOpacity>
        </View>
        <SubscriptionModal
          visible={modalVisible}
          subscription={editingSubscription}
          categories={data?.categories || []}
          workspaceId={workspaceId}
          onClose={() => {
            setModalVisible(false);
            setEditingSubscription(null);
          }}
          onSave={handleSaveSubscription}
          onDelete={(sub) => {
            setModalVisible(false);
            setEditingSubscription(null);
            handleDeleteSubscription(sub);
          }}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Monthly</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalMonthly, 'USD')}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Yearly</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalMonthly * 12, 'USD')}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{summary.activeCount}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        {groupedSubscriptions.map((group) => (
          <CategorySection
            key={group.category?.id || 'uncategorized'}
            category={group.category}
            subscriptions={group.subscriptions}
            totalCost={group.totalCost}
            onEditSubscription={handleEditSubscription}
            onDeleteSubscription={handleDeleteSubscription}
          />
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddSubscription}>
        <FontAwesome name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <SubscriptionModal
        visible={modalVisible}
        subscription={editingSubscription}
        categories={data?.categories || []}
        workspaceId={workspaceId}
        onClose={() => {
          setModalVisible(false);
          setEditingSubscription(null);
        }}
        onSave={handleSaveSubscription}
        onDelete={(sub) => {
          setModalVisible(false);
          setEditingSubscription(null);
          handleDeleteSubscription(sub);
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.text.muted,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent.purple,
  },
  sectionContent: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  cardInactive: {
    opacity: 0.5,
  },
  favicon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
  },
  fallbackIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.purple + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  inactiveTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.sm,
  },
  inactiveTagText: {
    fontSize: 10,
    color: colors.text.muted,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  costText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    fontFamily: 'SpaceMono',
  },
  cycleText: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '400',
  },
  separator: {
    marginHorizontal: spacing.sm,
    color: colors.border,
  },
  domainText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.muted,
  },
  notesText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardActionButton: {
    padding: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorIcon: {
    backgroundColor: `${colors.accent.red}20`,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent.purple,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg.secondary,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.text.muted,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text.primary,
  },
  formTextarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent.purple + '20',
    borderColor: colors.accent.purple,
  },
  chipText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.accent.purple,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  toggleLabel: {
    fontSize: 16,
    color: colors.text.primary,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg.tertiary,
    padding: 3,
  },
  toggleActive: {
    backgroundColor: colors.accent.purple,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    marginLeft: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.accent.red}15`,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.accent.red}30`,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.accent.red,
  },
});
