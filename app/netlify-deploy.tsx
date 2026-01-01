import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore, useProjectStore } from '@/src/stores';
import {
  netlifyCheckAuth,
  netlifySetToken,
  netlifyListSites,
  netlifyCreateSite,
  netlifyListDeploys,
  netlifyDeploy,
  netlifyRollback,
  type NetlifySite,
  type NetlifyDeploy,
} from '@/src/api/client';

// Token Setup Modal
function TokenModal({
  visible,
  onClose,
  onSave,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (token: string) => void;
  isLoading: boolean;
}) {
  const [token, setToken] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Connect Netlify</Text>
          <Text style={styles.modalDescription}>
            Enter your Netlify personal access token to deploy projects.
          </Text>

          <Text style={styles.inputLabel}>Personal Access Token</Text>
          <TextInput
            style={styles.textInput}
            value={token}
            onChangeText={setToken}
            placeholder="nfp_xxxxx..."
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.helpLink}
            onPress={() =>
              Linking.openURL('https://app.netlify.com/user/applications#personal-access-tokens')
            }
          >
            <FontAwesome name="external-link" size={12} color={colors.accent.blue} />
            <Text style={styles.helpLinkText}>Get token from Netlify</Text>
          </TouchableOpacity>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => onSave(token)}
              disabled={isLoading || !token.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#1e1e2e" />
              ) : (
                <Text style={styles.saveButtonText}>Connect</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Create Site Modal
function CreateSiteModal({
  visible,
  onClose,
  onSave,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Site</Text>

          <Text style={styles.inputLabel}>Site Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="my-awesome-site"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => onSave(name)}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#1e1e2e" />
              ) : (
                <Text style={styles.saveButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Deploy Card
function DeployCard({
  deploy,
  isLatest,
  onRollback,
}: {
  deploy: NetlifyDeploy;
  isLatest: boolean;
  onRollback: () => void;
}) {
  const getStatusColor = (state: string) => {
    switch (state) {
      case 'ready':
        return colors.accent.green;
      case 'building':
      case 'enqueued':
        return colors.accent.yellow;
      case 'error':
        return colors.accent.red;
      default:
        return colors.text.muted;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.deployCard}>
      <View style={styles.deployHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(deploy.state) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(deploy.state) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(deploy.state) }]}>
            {deploy.state}
          </Text>
        </View>
        {isLatest && (
          <View style={styles.latestBadge}>
            <Text style={styles.latestBadgeText}>Current</Text>
          </View>
        )}
      </View>

      <Text style={styles.deployDate}>{formatDate(deploy.created_at)}</Text>

      {deploy.error_message && (
        <Text style={styles.errorText} numberOfLines={2}>
          {deploy.error_message}
        </Text>
      )}

      <View style={styles.deployActions}>
        {deploy.state === 'ready' && (
          <TouchableOpacity
            style={styles.deployActionButton}
            onPress={() => Linking.openURL(deploy.deploy_ssl_url)}
          >
            <FontAwesome name="external-link" size={12} color={colors.accent.blue} />
            <Text style={styles.deployActionText}>Preview</Text>
          </TouchableOpacity>
        )}
        {!isLatest && deploy.state === 'ready' && (
          <TouchableOpacity
            style={styles.deployActionButton}
            onPress={onRollback}
          >
            <FontAwesome name="history" size={12} color={colors.accent.purple} />
            <Text style={styles.deployActionText}>Rollback</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Site Card
function SiteCard({
  site,
  isSelected,
  onSelect,
}: {
  site: NetlifySite;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.siteCard, isSelected && styles.siteCardSelected]}
      onPress={onSelect}
    >
      <View style={styles.siteIcon}>
        <FontAwesome name="globe" size={20} color={colors.accent.cyan} />
      </View>
      <View style={styles.siteInfo}>
        <Text style={styles.siteName}>{site.name}</Text>
        <Text style={styles.siteUrl} numberOfLines={1}>
          {site.ssl_url || site.url}
        </Text>
      </View>
      {isSelected && (
        <FontAwesome name="check-circle" size={20} color={colors.accent.green} />
      )}
    </TouchableOpacity>
  );
}

// Main Screen
export default function NetlifyDeployScreen() {
  const queryClient = useQueryClient();
  const { connection } = useConnectionStore();
  const { selectedProject } = useProjectStore();
  const isConnected = connection.status === 'connected';

  const [selectedSite, setSelectedSite] = useState<NetlifySite | null>(null);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [createSiteModalVisible, setCreateSiteModalVisible] = useState(false);
  const [showAllSites, setShowAllSites] = useState(false);
  const INITIAL_SITES_COUNT = 5;

  // Check Netlify auth
  const {
    data: authData,
    isLoading: isCheckingAuth,
    refetch: refetchAuth,
  } = useQuery({
    queryKey: ['netlify-auth'],
    queryFn: netlifyCheckAuth,
    enabled: isConnected,
  });

  // Fetch sites
  const {
    data: sites = [],
    isLoading: isLoadingSites,
    refetch: refetchSites,
    isRefetching: isRefetchingSites,
  } = useQuery({
    queryKey: ['netlify-sites'],
    queryFn: netlifyListSites,
    enabled: isConnected && authData?.authenticated,
  });

  // Fetch deploys for selected site
  const {
    data: deploys = [],
    isLoading: isLoadingDeploys,
    refetch: refetchDeploys,
  } = useQuery({
    queryKey: ['netlify-deploys', selectedSite?.id],
    queryFn: () => netlifyListDeploys(selectedSite!.id),
    enabled: isConnected && authData?.authenticated && !!selectedSite,
  });

  // Set token mutation
  const setTokenMutation = useMutation({
    mutationFn: netlifySetToken,
    onSuccess: () => {
      refetchAuth();
      refetchSites();
      setTokenModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Authentication Failed', error.message);
    },
  });

  // Create site mutation
  const createSiteMutation = useMutation({
    mutationFn: netlifyCreateSite,
    onSuccess: (site) => {
      refetchSites();
      setSelectedSite(site);
      setCreateSiteModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Failed to Create Site', error.message);
    },
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: ({ siteId, projectPath }: { siteId: string; projectPath: string }) =>
      netlifyDeploy(siteId, projectPath),
    onSuccess: () => {
      refetchDeploys();
      Alert.alert('Deploy Started', 'Your project is being deployed to Netlify.');
    },
    onError: (error: Error) => {
      Alert.alert('Deploy Failed', error.message);
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: ({ siteId, deployId }: { siteId: string; deployId: string }) =>
      netlifyRollback(siteId, deployId),
    onSuccess: () => {
      refetchDeploys();
      Alert.alert('Rollback Successful', 'The site has been rolled back.');
    },
    onError: (error: Error) => {
      Alert.alert('Rollback Failed', error.message);
    },
  });

  const handleDeploy = () => {
    if (!selectedSite || !selectedProject) return;

    Alert.alert(
      'Deploy to Netlify',
      `Deploy "${selectedProject.name}" to "${selectedSite.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deploy',
          onPress: () =>
            deployMutation.mutate({
              siteId: selectedSite.id,
              projectPath: selectedProject.path,
            }),
        },
      ]
    );
  };

  const handleRollback = (deploy: NetlifyDeploy) => {
    if (!selectedSite) return;

    Alert.alert(
      'Rollback Deploy',
      'Are you sure you want to rollback to this deploy?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rollback',
          style: 'destructive',
          onPress: () =>
            rollbackMutation.mutate({
              siteId: selectedSite.id,
              deployId: deploy.id,
            }),
        },
      ]
    );
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Deploy to Netlify' }} />
        <View style={styles.centeredContainer}>
          <FontAwesome name="chain-broken" size={48} color={colors.text.muted} />
          <Text style={styles.centeredText}>Not connected to desktop</Text>
        </View>
      </View>
    );
  }

  if (isCheckingAuth) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Deploy to Netlify' }} />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.accent.cyan} />
        </View>
      </View>
    );
  }

  // Not authenticated - show connect button
  if (!authData?.authenticated) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Deploy to Netlify' }} />
        <View style={styles.centeredContainer}>
          <FontAwesome name="cloud-upload" size={64} color={colors.accent.cyan} />
          <Text style={styles.centeredTitle}>Connect Netlify</Text>
          <Text style={styles.centeredDescription}>
            Connect your Netlify account to deploy projects directly from your phone.
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => setTokenModalVisible(true)}
          >
            <FontAwesome name="key" size={16} color="#1e1e2e" />
            <Text style={styles.connectButtonText}>Add Access Token</Text>
          </TouchableOpacity>
        </View>

        <TokenModal
          visible={tokenModalVisible}
          onClose={() => setTokenModalVisible(false)}
          onSave={(token) => setTokenMutation.mutate(token)}
          isLoading={setTokenMutation.isPending}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Deploy to Netlify' }} />

      {/* Project Selection Warning */}
      {!selectedProject && (
        <View style={styles.warningBanner}>
          <FontAwesome name="exclamation-triangle" size={16} color={colors.accent.yellow} />
          <Text style={styles.warningText}>Select a project first to deploy</Text>
        </View>
      )}

      {/* Selected Project */}
      {selectedProject && (
        <View style={styles.projectBanner}>
          <FontAwesome name="folder-o" size={16} color={colors.accent.purple} />
          <Text style={styles.projectBannerText}>{selectedProject.name}</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingSites}
            onRefresh={() => {
              refetchSites();
              if (selectedSite) refetchDeploys();
            }}
            tintColor={colors.accent.cyan}
          />
        }
      >
        {/* Sites Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Site</Text>
            <TouchableOpacity
              style={styles.addSiteButton}
              onPress={() => setCreateSiteModalVisible(true)}
            >
              <FontAwesome name="plus" size={12} color={colors.accent.cyan} />
              <Text style={styles.addSiteButtonText}>New Site</Text>
            </TouchableOpacity>
          </View>

          {isLoadingSites ? (
            <ActivityIndicator size="small" color={colors.accent.cyan} />
          ) : sites.length === 0 ? (
            <Text style={styles.emptyText}>No sites found</Text>
          ) : (
            <>
              {(showAllSites ? sites : sites.slice(0, INITIAL_SITES_COUNT)).map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  isSelected={selectedSite?.id === site.id}
                  onSelect={() => setSelectedSite(site)}
                />
              ))}
              {sites.length > INITIAL_SITES_COUNT && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowAllSites(!showAllSites)}
                >
                  <FontAwesome
                    name={showAllSites ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={colors.accent.cyan}
                  />
                  <Text style={styles.showMoreButtonText}>
                    {showAllSites
                      ? 'Show Less'
                      : `Show ${sites.length - INITIAL_SITES_COUNT} More Sites`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Deploy Button */}
        {selectedSite && selectedProject && (
          <TouchableOpacity
            style={[styles.deployButton, deployMutation.isPending && styles.deployButtonDisabled]}
            onPress={handleDeploy}
            disabled={deployMutation.isPending}
          >
            {deployMutation.isPending ? (
              <ActivityIndicator size="small" color="#1e1e2e" />
            ) : (
              <>
                <FontAwesome name="rocket" size={18} color="#1e1e2e" />
                <Text style={styles.deployButtonText}>Deploy Now</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Deploy History */}
        {selectedSite && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deploy History</Text>

            {isLoadingDeploys ? (
              <ActivityIndicator size="small" color={colors.accent.cyan} />
            ) : deploys.length === 0 ? (
              <Text style={styles.emptyText}>No deploys yet</Text>
            ) : (
              deploys.slice(0, 20).map((deploy, index) => (
                <DeployCard
                  key={deploy.id}
                  deploy={deploy}
                  isLatest={index === 0}
                  onRollback={() => handleRollback(deploy)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <TokenModal
        visible={tokenModalVisible}
        onClose={() => setTokenModalVisible(false)}
        onSave={(token) => setTokenMutation.mutate(token)}
        isLoading={setTokenMutation.isPending}
      />

      <CreateSiteModal
        visible={createSiteModalVisible}
        onClose={() => setCreateSiteModalVisible(false)}
        onSave={(name) => createSiteMutation.mutate(name)}
        isLoading={createSiteMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  centeredText: {
    fontSize: 16,
    color: colors.text.muted,
  },
  centeredTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  centeredDescription: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.cyan,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e2e',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.yellow + '20',
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    fontSize: 14,
    color: colors.accent.yellow,
  },
  projectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple + '20',
    padding: spacing.md,
    gap: spacing.sm,
  },
  projectBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  addSiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addSiteButtonText: {
    fontSize: 13,
    color: colors.accent.cyan,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  showMoreButtonText: {
    fontSize: 14,
    color: colors.accent.cyan,
    fontWeight: '500',
  },
  // Site Card
  siteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  siteCardSelected: {
    borderWidth: 2,
    borderColor: colors.accent.cyan,
  },
  siteIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.cyan + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  siteUrl: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  // Deploy Button
  deployButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.cyan,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  deployButtonDisabled: {
    opacity: 0.6,
  },
  deployButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e2e',
  },
  // Deploy Card
  deployCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  deployHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  latestBadge: {
    backgroundColor: colors.accent.purple + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  latestBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  deployDate: {
    fontSize: 12,
    color: colors.text.muted,
  },
  errorText: {
    fontSize: 12,
    color: colors.accent.red,
    marginTop: spacing.xs,
  },
  deployActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  deployActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deployActionText: {
    fontSize: 12,
    color: colors.accent.blue,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.text.muted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  helpLinkText: {
    fontSize: 13,
    color: colors.accent.blue,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.bg.tertiary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.muted,
  },
  saveButton: {
    backgroundColor: colors.accent.cyan,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e2e',
  },
});
