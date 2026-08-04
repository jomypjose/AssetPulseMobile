import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, Plus, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertTriangle, Package, X, Wrench, GitPullRequest, Box, Search, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  // Asset requests (helpdesk)
  getTickets, createTicket, approveTicketCH, approveTicketBSS, confirmTicketReceipt,
  // Service tickets
  getServiceTickets, getServiceTicketSummary, searchServiceAssets, createServiceTicket,
  approveServiceTicket, assignServiceTicket, startServiceTicket, resolveServiceTicket, closeServiceTicket,
  // Change requests
  getChangeRequests, getChangeRequestSummary, createChangeRequest, reviewChangeRequest,
  approveChangeRequest, implementChangeRequest, cancelChangeRequest,
} from '../services/api';
import { themed, C, R, S, cardShadow, elevation, CHROME } from '../theme';

// ── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'service', label: 'Service', Icon: Wrench },
  { key: 'change',  label: 'Change',  Icon: GitPullRequest },
  { key: 'asset',   label: 'Asset',   Icon: Box },
];

const SVC_ASSET_TYPES = ['Hardware', 'Software', 'Network'];
const SERVICE_TYPES   = ['Repair', 'Maintenance', 'Complaint', 'Breakdown'];
const CHANGE_TYPES    = ['Configuration', 'Relocation', 'Ownership', 'Upgrade', 'Disposal', 'Other'];
const PRIORITIES      = ['Low', 'Medium', 'High'];
const IMPACTS         = ['Low', 'Medium', 'High'];
const ASSET_REQ_TYPES = ['Desktop', 'Laptop', 'Printer', 'Scanner', 'Monitor', 'UPS', 'Other'];

const HD_TERMINAL = ['Completed', 'Received', 'Rejected'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const statusStyle = (s) => {
  const v = (s || '').toLowerCase();
  if (v.includes('reject') || v.includes('cancel'))                       return { color: C.offline, bg: C.offlineBg, Icon: XCircle };
  if (v.includes('closed') || v.includes('implement') || v.includes('complet') || v.includes('resolved') || v.includes('received'))
    return { color: C.online, bg: C.onlineBg, Icon: CheckCircle2 };
  if (v.includes('progress') || v.includes('assigned') || v.includes('review') || v.includes('approved') || v.includes('dispatch'))
    return { color: C.info, bg: C.infoBg, Icon: Clock };
  if (v.includes('pending') || v.includes('open') || v.includes('submitted') || v.includes('requested') || v.includes('draft'))
    return { color: C.warning, bg: C.warningBg, Icon: Clock };
  return { color: C.textMuted, bg: C.card, Icon: AlertTriangle };
};

const relDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ── Small UI primitives ──────────────────────────────────────────────────────
const Btn = ({ label, tone, onPress, disabled }) => (
  <TouchableOpacity
    style={[
      styles.actionBtn,
      tone === 'primary' && { backgroundColor: C.primary, borderColor: C.primary },
      tone === 'success' && { backgroundColor: C.online, borderColor: C.online },
      tone === 'danger'  && { backgroundColor: C.offline, borderColor: C.offline },
      disabled && { opacity: 0.5 },
    ]}
    onPress={disabled ? undefined : onPress}
    activeOpacity={0.85}
  >
    <Text style={[styles.actionBtnText, (tone === 'primary' || tone === 'success' || tone === 'danger') && { color: C.white }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const Chips = ({ options, value, onChange }) => (
  <View style={styles.chipRow}>
    {options.map((opt) => {
      const active = opt === value;
      return (
        <TouchableOpacity key={opt} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(opt)} activeOpacity={0.8}>
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const Field = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const DetailLine = ({ label, value }) => (
  <View style={styles.dlRow}>
    <Text style={styles.dlLabel}>{label}</Text>
    <Text style={styles.dlValue}>{value || '—'}</Text>
  </View>
);

// ── Ticket card (generic) ──────────────────────────────────────────────────────
const Card = ({ Icon, title, sub, status, reason, metaLeft, metaRight, onPress }) => {
  const s = statusStyle(status);
  const I = Icon || Package;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.statusStripe, { backgroundColor: s.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: `${s.color}20` }]}>
            <I color={s.color} size={16} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: `${s.color}55` }]}>
            <s.Icon color={s.color} size={11} strokeWidth={2.5} />
            <Text style={[styles.statusText, { color: s.color }]} numberOfLines={1}>{status || '—'}</Text>
          </View>
        </View>
        {!!reason && <Text style={styles.reason} numberOfLines={2}>{reason}</Text>}
        <View style={styles.cardFooter}>
          <Text style={styles.meta}>{metaLeft}</Text>
          <Text style={styles.meta}>{metaRight}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Asset search picker (for Service / Change creation) ────────────────────────
const AssetPicker = ({ assetType, value, onSelect, defaultBranch }) => {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => { setQuery(''); setResults([]); setOpen(false); }, [assetType]);

  const run = (q) => {
    clearTimeout(timer.current);
    if (!q || q.trim().length < 1) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { asset_type: assetType, q: q.trim(), limit: 20 };
        if (defaultBranch) params.branch_code = defaultBranch;
        const data = await searchServiceAssets(params);
        setResults(data.assets || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 280);
  };

  if (value) {
    return (
      <View style={styles.assetSelected}>
        <View style={{ flex: 1 }}>
          <Text style={styles.assetSelTitle} numberOfLines={1}>{value.label || value.item_id}</Text>
          <Text style={styles.assetSelSub} numberOfLines={1}>
            {value.item_id}{value.branch_code ? ` · ${value.branch_code}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => { onSelect(null); setQuery(''); }}>
          <X color={C.textMuted} size={16} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.searchBox}>
        <Search color={C.textMuted} size={15} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${assetType} by ID, serial, branch…`}
          placeholderTextColor={C.textDim}
          value={query}
          onChangeText={(t) => { setQuery(t); setOpen(true); run(t); }}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color={C.primary} size="small" />}
      </View>
      {open && results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.resultRow}
              onPress={() => { onSelect(a); setOpen(false); }}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={1}>{a.label || a.item_id}</Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {a.item_id}{a.sub1 ? ` · ${a.sub1}` : ''}{a.branch_code ? ` · ${a.branch_code}` : ''}
                </Text>
              </View>
              <ChevronRight color={C.textDim} size={15} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// ── Detail modal (works for all three types) ───────────────────────────────────
const DetailModal = ({ active, visible, onClose, onAction, isAdmin, isTech, userId, busy }) => {
  const [notes, setNotes] = useState('');
  useEffect(() => { setNotes(''); }, [active]);
  if (!active) return null;

  const { type, item } = active;
  const s = statusStyle(item.status || item.current_status);

  let titleNo, rows = [], actions = [], needsNotes = false;

  if (type === 'service') {
    const st = item.status;
    titleNo = item.ticket_no || `#${item.id}`;
    rows = [
      ['Status', st],
      ['Asset', `${item.asset_type || ''} ${item.asset_item_id ? `· ${item.asset_item_id}` : `#${item.asset_id || ''}`}`],
      ['Type', item.type],
      ['Priority', item.priority],
      ['Branch', item.branch_code],
      ['Title', item.title],
      ['Description', item.description],
      ['Created', relDate(item.created_at)],
    ];
    if (st === 'Pending Approval' && isAdmin) {
      actions = [
        { label: 'Reject', tone: 'danger', a: 'svc-reject' },
        { label: 'Approve', tone: 'primary', a: 'svc-approve' },
      ];
    } else if ((st === 'Open' || st === 'Approved') && isAdmin) {
      actions = [{ label: 'Assign to me', tone: 'primary', a: 'svc-assign' }];
    } else if (st === 'Assigned' && (isTech || isAdmin)) {
      actions = [{ label: 'Start Work', tone: 'primary', a: 'svc-start' }];
    } else if (st === 'In Progress' && (isTech || isAdmin)) {
      needsNotes = true;
      actions = [{ label: 'Resolve', tone: 'success', a: 'svc-resolve' }];
    } else if (st === 'Resolved' && isAdmin) {
      actions = [{ label: 'Close Ticket', tone: 'success', a: 'svc-close' }];
    }
  } else if (type === 'change') {
    const st = item.status;
    const isOwner = item.raised_by === userId;
    const terminal = ['Implemented', 'Rejected', 'Cancelled'].includes(st);
    titleNo = item.cr_no || `#${item.id}`;
    rows = [
      ['Status', st],
      ['Asset', `${item.asset_type || ''} #${item.asset_id || ''}`],
      ['Change type', item.change_type],
      ['Priority', item.priority],
      ['Impact', item.impact],
      ['Branch', item.branch_code],
      ['Title', item.title],
      ['Description', item.description],
      ['Justification', item.justification],
      ['Created', relDate(item.created_at)],
    ];
    if (st === 'Submitted' && isAdmin) {
      actions = [
        { label: 'Reject', tone: 'danger', a: 'cr-reject' },
        { label: 'Start Review', tone: 'primary', a: 'cr-review' },
        { label: 'Approve', tone: 'success', a: 'cr-approve' },
      ];
    } else if (st === 'Under Review' && isAdmin) {
      actions = [
        { label: 'Reject', tone: 'danger', a: 'cr-reject' },
        { label: 'Approve', tone: 'success', a: 'cr-approve' },
      ];
    } else if (st === 'Approved' && isAdmin) {
      actions = [{ label: 'Implement', tone: 'success', a: 'cr-implement' }];
    }
    if (!terminal && (isOwner || isAdmin)) {
      actions = [...actions, { label: 'Cancel', tone: 'danger', a: 'cr-cancel' }];
    }
  } else {
    // asset request
    const st = item.current_status || '';
    titleNo = item.ticket_no || `#${item.id}`;
    rows = [
      ['Status', st],
      ['Type', item.request_type || 'NEW'],
      ['Asset type', item.asset_type],
      ['Quantity', String(item.quantity || 1)],
      ['Priority', item.priority],
      ['Branch', `${item.branch_code || ''}${item.branch_name ? ` · ${item.branch_name}` : ''}`],
      ['Reason', item.reason],
      ['Created', relDate(item.created_at)],
    ];
    const canCH  = isAdmin && /^pending.*ch/i.test(st);
    const canBSS = isAdmin && /^pending.*bss/i.test(st);
    const canConfirm = !isAdmin && /completed/i.test(st);
    if (canCH)  actions = [{ label: 'Reject', tone: 'danger', a: 'hd-ch-reject' }, { label: 'Approve', tone: 'primary', a: 'hd-ch-approve' }];
    if (canBSS) actions = [{ label: 'Reject', tone: 'danger', a: 'hd-bss-reject' }, { label: 'Approve', tone: 'primary', a: 'hd-bss-approve' }];
    if (canConfirm) actions = [{ label: 'Confirm receipt', tone: 'primary', a: 'hd-confirm' }];
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{titleNo}</Text>
            <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }}>
            <View style={[styles.detailRow, { backgroundColor: s.bg, borderColor: `${s.color}44` }]}>
              <s.Icon color={s.color} size={14} strokeWidth={2.5} />
              <Text style={[styles.detailStatus, { color: s.color }]}>{item.status || item.current_status}</Text>
            </View>
            {rows.map(([label, value]) => <DetailLine key={label} label={label} value={value} />)}

            {needsNotes && (
              <Field label="Resolution notes">
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  placeholder="What was done to resolve it…"
                  placeholderTextColor={C.textDim}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </Field>
            )}
          </ScrollView>

          {actions.length > 0 && (
            <View style={styles.modalActions}>
              {actions.map((act) => (
                <Btn
                  key={act.a}
                  label={act.label}
                  tone={act.tone}
                  disabled={busy}
                  onPress={() => onAction(act.a, item, notes)}
                />
              ))}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Create: Service ticket ─────────────────────────────────────────────────────
const CreateServiceModal = ({ visible, onClose, onCreated, defaultBranch }) => {
  const [assetType, setAssetType] = useState('Hardware');
  const [asset, setAsset]   = useState(null);
  const [type, setType]     = useState('Repair');
  const [priority, setPriority] = useState('Medium');
  const [title, setTitle]   = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setAsset(null); setTitle(''); setDescription(''); setType('Repair'); setPriority('Medium'); };

  const submit = async () => {
    if (!asset)        { Alert.alert('Validation', 'Please select an asset.'); return; }
    if (!title.trim()) { Alert.alert('Validation', 'Title is required.'); return; }
    setSubmitting(true);
    try {
      await createServiceTicket({
        asset_type: assetType,
        asset_id: asset.id,
        branch_code: asset.branch_code,
        type, priority,
        title: title.trim(),
        description: description.trim(),
      });
      onCreated?.(); onClose?.(); reset();
    } catch (err) {
      Alert.alert('Could not create ticket', err.response?.data?.error || err.message || 'Try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New service request</Text>
            <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
            <Field label="Asset category"><Chips options={SVC_ASSET_TYPES} value={assetType} onChange={(v) => { setAssetType(v); setAsset(null); }} /></Field>
            <Field label="Asset"><AssetPicker assetType={assetType} value={asset} onSelect={setAsset} defaultBranch={defaultBranch} /></Field>
            <Field label="Issue type"><Chips options={SERVICE_TYPES} value={type} onChange={setType} /></Field>
            <Field label="Priority"><Chips options={PRIORITIES} value={priority} onChange={setPriority} /></Field>
            <Field label="Title">
              <TextInput style={styles.input} placeholder="Short summary" placeholderTextColor={C.textDim} value={title} onChangeText={setTitle} />
            </Field>
            <Field label="Description">
              <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} placeholder="Describe the issue…" placeholderTextColor={C.textDim} value={description} onChangeText={setDescription} multiline />
            </Field>
          </ScrollView>
          <View style={styles.modalActions}>
            <Btn label="Cancel" onPress={onClose} />
            <Btn label={submitting ? 'Submitting…' : 'Submit'} tone="primary" disabled={submitting} onPress={submit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Create: Change request ─────────────────────────────────────────────────────
const CreateChangeModal = ({ visible, onClose, onCreated, defaultBranch }) => {
  const [assetType, setAssetType] = useState('Hardware');
  const [asset, setAsset]   = useState(null);
  const [changeType, setChangeType] = useState('Configuration');
  const [priority, setPriority] = useState('Medium');
  const [impact, setImpact] = useState('Low');
  const [title, setTitle]   = useState('');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setAsset(null); setTitle(''); setDescription(''); setJustification(''); setChangeType('Configuration'); setPriority('Medium'); setImpact('Low'); };

  const submit = async () => {
    if (!asset)              { Alert.alert('Validation', 'Please select an asset.'); return; }
    if (!title.trim())       { Alert.alert('Validation', 'Title is required.'); return; }
    if (!description.trim()) { Alert.alert('Validation', 'Description is required.'); return; }
    setSubmitting(true);
    try {
      await createChangeRequest({
        asset_type: assetType,
        asset_id: asset.id,
        branch_code: asset.branch_code,
        change_type: changeType,
        priority, impact,
        title: title.trim(),
        description: description.trim(),
        justification: justification.trim(),
      });
      onCreated?.(); onClose?.(); reset();
    } catch (err) {
      Alert.alert('Could not create request', err.response?.data?.error || err.message || 'Try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New change request</Text>
            <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
            <Field label="Asset category"><Chips options={SVC_ASSET_TYPES} value={assetType} onChange={(v) => { setAssetType(v); setAsset(null); }} /></Field>
            <Field label="Asset"><AssetPicker assetType={assetType} value={asset} onSelect={setAsset} defaultBranch={defaultBranch} /></Field>
            <Field label="Change type"><Chips options={CHANGE_TYPES} value={changeType} onChange={setChangeType} /></Field>
            <Field label="Priority"><Chips options={PRIORITIES} value={priority} onChange={setPriority} /></Field>
            <Field label="Impact"><Chips options={IMPACTS} value={impact} onChange={setImpact} /></Field>
            <Field label="Title">
              <TextInput style={styles.input} placeholder="Short summary" placeholderTextColor={C.textDim} value={title} onChangeText={setTitle} />
            </Field>
            <Field label="Description">
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Describe the change…" placeholderTextColor={C.textDim} value={description} onChangeText={setDescription} multiline />
            </Field>
            <Field label="Justification">
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Why is this needed?" placeholderTextColor={C.textDim} value={justification} onChangeText={setJustification} multiline />
            </Field>
          </ScrollView>
          <View style={styles.modalActions}>
            <Btn label="Cancel" onPress={onClose} />
            <Btn label={submitting ? 'Submitting…' : 'Submit'} tone="primary" disabled={submitting} onPress={submit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Create: Asset request ──────────────────────────────────────────────────────
const CreateAssetReqModal = ({ visible, onClose, onCreated, defaultBranch }) => {
  const [assetType, setAssetType] = useState(ASSET_REQ_TYPES[0]);
  const [qty, setQty]         = useState('1');
  const [priority, setPriority] = useState('Medium');
  const [reason, setReason]   = useState('');
  const [branchCode, setBranchCode] = useState(defaultBranch || '');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!branchCode.trim()) { Alert.alert('Validation', 'Branch code is required.'); return; }
    if (!reason.trim())     { Alert.alert('Validation', 'Reason is required.'); return; }
    setSubmitting(true);
    try {
      await createTicket({
        request_type: 'NEW',
        asset_type: assetType,
        quantity: parseInt(qty, 10) || 1,
        priority,
        reason: reason.trim(),
        branch_code: branchCode.trim().toUpperCase(),
      });
      onCreated?.(); onClose?.(); setReason('');
    } catch (err) {
      Alert.alert('Could not create request', err.response?.data?.error || err.message || 'Try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New asset request</Text>
            <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            <Field label="Branch code">
              <TextInput style={styles.input} placeholder="e.g. BLR01" placeholderTextColor={C.textDim} value={branchCode} onChangeText={setBranchCode} autoCapitalize="characters" />
            </Field>
            <Field label="Asset type"><Chips options={ASSET_REQ_TYPES} value={assetType} onChange={setAssetType} /></Field>
            <Field label="Quantity">
              <TextInput style={styles.input} value={qty} onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
            </Field>
            <Field label="Priority"><Chips options={PRIORITIES} value={priority} onChange={setPriority} /></Field>
            <Field label="Reason">
              <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} placeholder="Explain the need…" placeholderTextColor={C.textDim} value={reason} onChangeText={setReason} multiline />
            </Field>
          </ScrollView>
          <View style={styles.modalActions}>
            <Btn label="Cancel" onPress={onClose} />
            <Btn label={submitting ? 'Submitting…' : 'Submit'} tone="primary" disabled={submitting} onPress={submit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Type picker ────────────────────────────────────────────────────────────────
const TYPE_OPTS = [
  { id: 'service', Icon: Wrench,         label: 'Service Request', desc: 'Report a hardware/software/network issue.' },
  { id: 'change',  Icon: GitPullRequest, label: 'Change Request',  desc: 'Request a configuration or asset change.' },
  { id: 'asset',   Icon: Box,            label: 'Asset Request',   desc: 'Request new asset allocation.' },
];

const TypePicker = ({ visible, onSelect, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Raise a new ticket</Text>
          <TouchableOpacity onPress={onClose}><X color={C.textMuted} size={20} /></TouchableOpacity>
        </View>
        <View style={{ gap: S.sm }}>
          {TYPE_OPTS.map((t) => (
            <TouchableOpacity key={t.id} style={styles.typeCard} onPress={() => onSelect(t.id)} activeOpacity={0.85}>
              <View style={styles.typeIcon}><t.Icon color={C.primary} size={18} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeLabel}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </View>
              <ChevronRight color={C.textDim} size={16} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  </Modal>
);

// ── Main screen ────────────────────────────────────────────────────────────────
const TicketsHubScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = user?.role || '';
  const isAdmin = ['admin', 'super_admin', 'admin_staff'].includes(role);
  const isTech  = isAdmin || role === 'technician';
  const defaultBranch = user?.branches?.[0]?.branch_code;

  const [tab, setTab]         = useState('service');
  const [lists, setLists]     = useState({ service: [], change: [], asset: [] });
  const [summary, setSummary] = useState({ svc: {}, cr: {}, hd: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive]   = useState(null);     // { type, item }
  const [busy, setBusy]       = useState(false);
  const [typePicker, setTypePicker] = useState(false);
  const [createType, setCreateType] = useState(null);

  const loadAll = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [svc, cr, svcSum, crSum, hd] = await Promise.all([
        getServiceTickets().catch(() => ({ tickets: [] })),
        getChangeRequests().catch(() => ({ requests: [] })),
        getServiceTicketSummary().catch(() => ({ summary: {} })),
        getChangeRequestSummary().catch(() => ({ summary: {} })),
        getTickets().catch(() => []),
      ]);
      const hdList = Array.isArray(hd) ? hd : (hd?.data || hd?.tickets || []);
      setLists({ service: svc.tickets || [], change: cr.requests || [], asset: hdList });
      setSummary({
        svc: svcSum.summary || {},
        cr: crSum.summary || {},
        hd: { pending: hdList.filter((t) => !HD_TERMINAL.includes(t.current_status)).length, total: hdList.length },
      });
    } catch (err) {
      Alert.alert('Could not load tickets', err.message || 'Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAction = async (action, item, notes) => {
    if (action === 'svc-resolve' && !notes.trim()) { Alert.alert('Notes required', 'Add resolution notes before resolving.'); return; }
    setBusy(true);
    try {
      switch (action) {
        // Service
        case 'svc-approve':  await approveServiceTicket(item.id, { action: 'approve', remarks: notes }); break;
        case 'svc-reject':   await approveServiceTicket(item.id, { action: 'reject', remarks: notes }); break;
        case 'svc-assign':   await assignServiceTicket(item.id, { assigned_to: user.id }); break;
        case 'svc-start':    await startServiceTicket(item.id); break;
        case 'svc-resolve':  await resolveServiceTicket(item.id, { resolution_notes: notes.trim() }); break;
        case 'svc-close':    await closeServiceTicket(item.id); break;
        // Change
        case 'cr-review':    await reviewChangeRequest(item.id, { remarks: notes }); break;
        case 'cr-approve':   await approveChangeRequest(item.id, { action: 'approve', remarks: notes }); break;
        case 'cr-reject':    await approveChangeRequest(item.id, { action: 'reject', remarks: notes }); break;
        case 'cr-implement': await implementChangeRequest(item.id, { impl_notes: notes }); break;
        case 'cr-cancel':    await cancelChangeRequest(item.id); break;
        // Asset request
        case 'hd-ch-approve':  await approveTicketCH(item.id, { approved: true }); break;
        case 'hd-ch-reject':   await approveTicketCH(item.id, { approved: false }); break;
        case 'hd-bss-approve': await approveTicketBSS(item.id, { approved: true }); break;
        case 'hd-bss-reject':  await approveTicketBSS(item.id, { approved: false }); break;
        case 'hd-confirm':     await confirmTicketReceipt(item.id); break;
        default: break;
      }
      setActive(null);
      loadAll(true);
    } catch (err) {
      Alert.alert('Action failed', err.response?.data?.error || err.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onTypeSelect = (t) => { setTypePicker(false); setTab(t); setCreateType(t); };

  const data = lists[tab];
  const totalOpen = (summary.svc?.open || 0) + (summary.cr?.pending || 0) + (summary.hd?.pending || 0);

  const stats = [
    { label: 'Service Open', value: summary.svc?.open, color: C.warning },
    { label: 'In Progress',  value: summary.svc?.inProgress, color: C.info },
    { label: 'Resolved',     value: (summary.svc?.resolved || 0) + (summary.svc?.closed || 0), color: C.online },
    { label: 'Changes',      value: summary.cr?.pending, color: C.warning },
    { label: 'Asset Reqs',   value: summary.hd?.pending, color: C.info },
  ];

  const renderItem = ({ item }) => {
    if (tab === 'service') {
      return (
        <Card
          Icon={Wrench}
          title={`${item.ticket_no || `#${item.id}`} · ${item.type || 'Service'}`}
          sub={`${item.asset_type || ''}${item.branch_code ? ` · ${item.branch_code}` : ''}`}
          status={item.status}
          reason={item.title}
          metaLeft={item.priority || 'Medium'}
          metaRight={relDate(item.created_at)}
          onPress={() => setActive({ type: 'service', item })}
        />
      );
    }
    if (tab === 'change') {
      return (
        <Card
          Icon={GitPullRequest}
          title={`${item.cr_no || `#${item.id}`} · ${item.change_type || 'Change'}`}
          sub={`${item.asset_type || ''}${item.branch_code ? ` · ${item.branch_code}` : ''}`}
          status={item.status}
          reason={item.title}
          metaLeft={`${item.priority || 'Medium'} · ${item.impact || 'Low'} impact`}
          metaRight={relDate(item.created_at)}
          onPress={() => setActive({ type: 'change', item })}
        />
      );
    }
    return (
      <Card
        Icon={Package}
        title={`${item.ticket_no || `#${item.id}`} · ${item.asset_type || 'Asset'}`}
        sub={`${item.branch_code || ''}${item.branch_name ? ` · ${item.branch_name}` : ''}`}
        status={item.current_status}
        reason={item.reason}
        metaLeft={`Qty ${item.quantity || 1} · ${item.priority || 'Medium'}`}
        metaRight={relDate(item.created_at)}
        onPress={() => setActive({ type: 'asset', item })}
      />
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft color={CHROME.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tickets Hub</Text>
          <Text style={styles.headerSub}>{totalOpen} open across all types</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => loadAll(true)} activeOpacity={0.7}>
          <RefreshCw color={C.primary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.createBtn} onPress={() => setTypePicker(true)} activeOpacity={0.85}>
          <Plus color={C.white} size={16} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingHorizontal: S.md }}>
          {stats.map((st) => (
            <View key={st.label} style={styles.statCard}>
              <View style={[styles.statDot, { backgroundColor: st.color }]} />
              <Text style={styles.statValue}>{loading ? '—' : (st.value ?? 0)}</Text>
              <Text style={styles.statLabel}>{st.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const activeTab = tab === t.key;
          const badge = t.key === 'service' ? summary.svc?.open
                      : t.key === 'change'  ? summary.cr?.pending
                      : summary.hd?.pending;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, activeTab && styles.tabActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <t.Icon color={activeTab ? C.primary : C.textMuted} size={15} strokeWidth={activeTab ? 2.4 : 1.8} />
              <Text style={[styles.tabText, activeTab && styles.tabTextActive]}>{t.label}</Text>
              {!loading && badge > 0 && (
                <View style={[styles.tabBadge, activeTab && { backgroundColor: `${C.primary}22` }]}>
                  <Text style={[styles.tabBadgeText, activeTab && { color: C.primary }]}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : data.length === 0 ? (
        <View style={styles.centered}>
          <AlertTriangle color={C.textDim} size={38} />
          <Text style={styles.emptyText}>No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} tickets yet.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => `${tab}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + S.xxxxl }}
          ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={C.primary} colors={[C.primary]} />}
        />
      )}

      {/* Detail */}
      <DetailModal
        active={active}
        visible={!!active}
        onClose={() => setActive(null)}
        onAction={handleAction}
        isAdmin={isAdmin}
        isTech={isTech}
        userId={user?.id}
        busy={busy}
      />

      {/* Type picker + create modals */}
      <TypePicker visible={typePicker} onSelect={onTypeSelect} onClose={() => setTypePicker(false)} />
      <CreateServiceModal  visible={createType === 'service'} onClose={() => setCreateType(null)} onCreated={() => loadAll(true)} defaultBranch={defaultBranch} />
      <CreateChangeModal   visible={createType === 'change'}  onClose={() => setCreateType(null)} onCreated={() => loadAll(true)} defaultBranch={defaultBranch} />
      <CreateAssetReqModal visible={createType === 'asset'}   onClose={() => setCreateType(null)} onCreated={() => loadAll(true)} defaultBranch={defaultBranch} />
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

  statsWrap: { paddingVertical: S.md, backgroundColor: C.bg },
  statCard: {
    minWidth: 92, padding: S.md, borderRadius: R.md,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: S.sm },
  statValue: { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 10, color: C.textMuted, marginTop: 2 },

  tabBar: {
    flexDirection: 'row', paddingHorizontal: S.md, gap: S.xs,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: S.md, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 12.5, fontWeight: '600', color: C.textMuted },
  tabTextActive: { color: C.primary, fontWeight: '700' },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: R.full, backgroundColor: C.offlineBg, minWidth: 18, alignItems: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: C.offline },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  emptyText: { color: C.textMuted, fontSize: 13 },

  card: {
    flexDirection: 'row', borderRadius: R.lg, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, ...cardShadow,
  },
  statusStripe: { width: 4 },
  cardBody: { flex: 1, padding: S.md, gap: S.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  iconBox: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.full, borderWidth: 1, maxWidth: 130,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  reason: { fontSize: 12, color: C.textSub, lineHeight: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 11, color: C.textDim },

  modalBackdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.bg, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl,
    padding: S.lg, gap: S.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: S.sm, borderWidth: 1, borderRadius: R.md, marginBottom: S.sm,
  },
  detailStatus: { fontSize: 13, fontWeight: '700' },
  dlRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  dlLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  dlValue: { fontSize: 13, color: C.text, maxWidth: '60%', textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: S.sm, justifyContent: 'flex-end', marginTop: S.sm, flexWrap: 'wrap' },
  actionBtn: {
    paddingHorizontal: S.lg, paddingVertical: 10, borderRadius: R.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  actionBtnText: { color: C.text, fontWeight: '700', fontSize: 13 },

  field: { marginBottom: S.md },
  fieldLabel: { fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: S.xs },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 10, fontSize: 14, color: C.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  chipText: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  chipTextActive: { color: C.primary, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },
  resultsBox: {
    marginTop: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  resultTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  resultSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  assetSelected: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.primaryBg, borderWidth: 1, borderColor: `${C.primary}55`,
    borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 10,
  },
  assetSelTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  assetSelSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    padding: S.md, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  typeIcon: { width: 38, height: 38, borderRadius: R.sm, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  typeDesc: { fontSize: 11, color: C.textMuted, marginTop: 2 },
}));

export default TicketsHubScreen;
