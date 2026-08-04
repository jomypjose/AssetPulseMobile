import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, ActivityIndicator, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Plus, ClipboardList, CheckCircle2, Clock, X, RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getJobs, createJob, closeJob } from '../services/api';
import FadeIn from '../components/FadeIn';
import { themed, C, R, S, cardShadow, elevation, CHROME, BACKDROP } from '../theme';

const JOB_TYPES = ['Hardware', 'Software', 'Network', 'Logistics', 'Other'];

const yyyymmdd = (d) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const fmtTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const JobCard = ({ job, onClose }) => {
  const isClosed = !!job.solution_description || job.status === 'Closed';
  return (
    <View style={[styles.card, isClosed && { opacity: 0.7 }]}>
      <View style={[styles.stripe, { backgroundColor: isClosed ? C.online : C.warning }]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: isClosed ? C.onlineBg : C.warningBg }]}>
            {isClosed
              ? <CheckCircle2 color={C.online} size={16} strokeWidth={2.4} />
              : <Clock color={C.warning} size={16} strokeWidth={2.4} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{job.job_type || 'Job'}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {job.branch_code || ''}{job.branch_name ? ` · ${job.branch_name}` : ''}
            </Text>
          </View>
          <Text style={styles.time}>{fmtTime(job.start_time || job.created_at)}</Text>
        </View>

        <Text style={styles.issue} numberOfLines={3}>{job.issue_description}</Text>

        {isClosed && job.solution_description ? (
          <View style={styles.solution}>
            <Text style={styles.solutionLabel}>Solution</Text>
            <Text style={styles.solutionText}>{job.solution_description}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.closeBtn} onPress={() => onClose(job)} activeOpacity={0.85}>
            <CheckCircle2 color={C.white} size={14} strokeWidth={2.4} />
            <Text style={styles.closeText}>Close with solution</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const SolutionModal = ({ job, visible, onClose, onClosed }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) setText(''); }, [visible]);

  if (!job) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Close job</Text>
            <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
          </View>
          <Text style={styles.issue}>{job.issue_description}</Text>

          <Text style={styles.fieldLabel}>Solution</Text>
          <TextInput
            style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
            placeholder="What did you do to resolve this?"
            placeholderTextColor={C.textDim}
            value={text}
            onChangeText={setText}
            multiline
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.primary }]}
              onPress={async () => {
                if (!text.trim()) { Alert.alert('Validation', 'Please enter a solution.'); return; }
                setBusy(true);
                try {
                  await closeJob(job.id, text.trim());
                  onClosed?.();
                  onClose?.();
                } catch (err) {
                  Alert.alert('Failed', err.message || 'Try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={[styles.actionBtnText, { color: C.white }]}>
                {busy ? 'Closing…' : 'Close job'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const CreateJobModal = ({ visible, onClose, onCreated, defaultBranch }) => {
  const [jobType, setJobType]    = useState(JOB_TYPES[0]);
  const [branch, setBranch]      = useState(defaultBranch || '');
  const [branchName, setBN]      = useState('');
  const [desc, setDesc]          = useState('');
  const [busy, setBusy]          = useState(false);

  useEffect(() => {
    if (visible) {
      setJobType(JOB_TYPES[0]);
      setBranch(defaultBranch || '');
      setBN('');
      setDesc('');
    }
  }, [visible, defaultBranch]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New job</Text>
            <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipRow}>
              {JOB_TYPES.map((t) => {
                const active = t === jobType;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setJobType(t)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Branch code</Text>
            <TextInput
              style={styles.input}
              value={branch}
              onChangeText={setBranch}
              autoCapitalize="characters"
              placeholder="e.g. BLR01"
              placeholderTextColor={C.textDim}
            />

            <Text style={styles.fieldLabel}>Branch name</Text>
            <TextInput
              style={styles.input}
              value={branchName}
              onChangeText={setBN}
              placeholder="Optional"
              placeholderTextColor={C.textDim}
            />

            <Text style={styles.fieldLabel}>Issue description</Text>
            <TextInput
              style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
              value={desc}
              onChangeText={setDesc}
              multiline
              placeholder="What's the problem?"
              placeholderTextColor={C.textDim}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.primary }]}
              onPress={async () => {
                if (!branch.trim() || !desc.trim()) {
                  Alert.alert('Validation', 'Branch and description are required.');
                  return;
                }
                setBusy(true);
                try {
                  await createJob({
                    branch_code:  branch.trim().toUpperCase(),
                    branch_name:  branchName.trim() || undefined,
                    job_type:     jobType,
                    issue_description: desc.trim(),
                  });
                  onCreated?.();
                  onClose?.();
                } catch (err) {
                  Alert.alert('Failed', err.message || 'Try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={[styles.actionBtnText, { color: C.white }]}>
                {busy ? 'Creating…' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const DailyJobsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [date, setDate] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingJob, setClosingJob] = useState(null);
  const [creating,   setCreating]   = useState(false);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getJobs(yyyymmdd(date));
      const list = data?.data || data?.jobs || data || [];
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      Alert.alert('Could not load jobs', err.message || 'Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
  };

  const openJobs   = jobs.filter((j) => !j.solution_description && j.status !== 'Closed').length;
  const closedJobs = jobs.length - openJobs;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Daily Jobs</Text>
          <Text style={styles.headerSub}>{openJobs} open · {closedJobs} closed</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => fetchJobs(true)} activeOpacity={0.7}>
          <RefreshCw color={C.primary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.createBtn} onPress={() => setCreating(true)} activeOpacity={0.85}>
          <Plus color={C.white} size={16} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDate(-1)}>
          <Text style={styles.dateNav}>‹ prev</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{date.toDateString()}</Text>
        <TouchableOpacity onPress={() => shiftDate(1)}>
          <Text style={styles.dateNav}>next ›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.centered}>
          <ClipboardList color={C.textDim} size={44} strokeWidth={1.1} />
          <Text style={styles.emptyText}>No jobs on this date</Text>
          <Text style={styles.emptySub}>Try a different date, or pull down to refresh.</Text>
        </View>
      ) : (
        <FadeIn style={{ flex: 1 }}>
        <FlatList
          data={jobs}
          keyExtractor={(j) => String(j.id)}
          renderItem={({ item }) => <JobCard job={item} onClose={setClosingJob} />}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
          ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchJobs(true)} tintColor={C.primary} colors={[C.primary]} />
          }
        />
        </FadeIn>
      )}

      <SolutionModal
        job={closingJob}
        visible={!!closingJob}
        onClose={() => setClosingJob(null)}
        onClosed={() => fetchJobs(true)}
      />

      <CreateJobModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={() => fetchJobs(true)}
        defaultBranch={user?.branches?.[0]?.branch_code}
      />
    </View>
  );
};

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: S.md,
    backgroundColor: CHROME.bg, borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: CHROME.text },
  headerSub:   { fontSize: 11, color: CHROME.textMuted, marginTop: 2 },
  headerBtn: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}33`,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtn: {
    width: 38, height: 38, borderRadius: R.sm, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', ...elevation(2),
  },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.lg, paddingVertical: S.md, backgroundColor: C.bg,
  },
  dateText: { fontSize: 14, fontWeight: '700', color: C.text },
  dateNav:  { fontSize: 12, color: C.primary, fontWeight: '700' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingHorizontal: S.xxxl },
  emptyText: { color: C.textMuted, fontSize: 16, fontWeight: '600', marginTop: S.sm },
  emptySub:  { color: C.textDim, fontSize: 13, textAlign: 'center' },

  card: {
    flexDirection: 'row', borderRadius: R.lg, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, ...cardShadow,
  },
  stripe: { width: 4 },
  body:   { flex: 1, padding: S.md, gap: S.sm },
  row:    { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  iconBox:{ width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  title:  { fontSize: 14, fontWeight: '700', color: C.text },
  sub:    { fontSize: 11, color: C.textMuted, marginTop: 2 },
  time:   { fontSize: 11, color: C.textDim },
  issue:  { fontSize: 13, color: C.textSub, lineHeight: 18 },

  solution: {
    borderTopWidth: 1, borderTopColor: C.borderFaint,
    paddingTop: S.sm, marginTop: S.xs,
  },
  solutionLabel: { fontSize: 10, fontWeight: '700', color: C.online, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  solutionText:  { fontSize: 12, color: C.textSub },

  closeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    alignSelf: 'flex-start',
    backgroundColor: C.online, paddingHorizontal: S.md, paddingVertical: 7,
    borderRadius: R.sm,
  },
  closeText: { color: C.white, fontSize: 12, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: BACKDROP, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl,
    padding: S.lg, gap: S.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:  { fontSize: 16, fontWeight: '800', color: C.text },
  fieldLabel:  { fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: S.xs, marginTop: S.sm },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 10,
    fontSize: 14, color: C.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:    {
    paddingHorizontal: S.md, paddingVertical: 6,
    borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  chipActive:     { backgroundColor: C.primaryBg, borderColor: C.primary },
  chipText:       { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  chipTextActive: { color: C.primary, fontWeight: '700' },

  modalActions: { flexDirection: 'row', gap: S.sm, justifyContent: 'flex-end', marginTop: S.md },
  actionBtn: {
    paddingHorizontal: S.lg, paddingVertical: 10,
    borderRadius: R.sm, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  actionBtnText: { color: C.text, fontWeight: '700', fontSize: 13 },
}));

export default DailyJobsScreen;
