/**
 * AssetFormScreen — create or edit an asset of any of the four kinds.
 *
 * Route params:
 *   kind    'hardware' | 'fixed' | 'software' | 'network'   (required)
 *   asset   existing record → edit mode; omitted → create mode
 *   branch  pre-selects the branch when created from a branch page
 *
 * ── One screen, four shapes ──────────────────────────────────────────────────
 * The kinds live in different tables with different columns, so the form is
 * driven by a per-kind field spec rather than four near-identical screens.
 * Fixed assets share hardware's table and endpoints — the only difference is
 * that their asset_type comes from the server's `fixed` category.
 *
 * ── Why edits merge over the original record ─────────────────────────────────
 * PUT /hardware/:id is not a partial update: the server rewrites in_date,
 * out_date, purchase_date, warranty_expiry and asset_status on every call, and
 * maps absent dates to null. A form that posts only its own fields would wipe
 * whatever it does not show. Hardware edits therefore go through
 * buildHardwarePayload(), which carries the untouched columns back.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, FlatList, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft, ChevronDown, Check, X as XIcon, Save,
} from 'lucide-react-native';
import { themed, C, R, S, elevation, CHROME } from '../theme';
import { useAuth } from '../context/AuthContext';
import { ASSET_WRITERS, getAssetTypes } from '../services/api';
import { buildHardwarePayload } from '../services/assetVerification';

// Matches the server's hardware asset_status enum. Kept in the same order as
// schemas/hardware.schema.js so the two stay easy to diff.
const HARDWARE_STATUSES = [
  'Active', 'Allocated', 'Ready for Allocation', 'Available at Branch',
  'Under Repair', 'Damaged', 'Moved to Scrap', 'Lost', 'Stolen',
];

const KIND_TITLES = {
  hardware: 'hardware asset',
  fixed:    'fixed asset',
  software: 'software asset',
  network:  'network device',
};

/**
 * Field specs. `required` mirrors the server's own validation, so the form
 * refuses what the API would reject anyway rather than round-tripping an error.
 */
const FIELDS = {
  hardware: [
    { key: 'asset_type',      label: 'Asset type',    type: 'assetType', required: true },
    { key: 'brand_name',      label: 'Brand',         type: 'text' },
    { key: 'model_name',      label: 'Model',         type: 'text' },
    { key: 'serial_number',   label: 'Serial number', type: 'text', autoCapitalize: 'characters' },
    { key: 'branch_code',     label: 'Branch',        type: 'branch' },
    { key: 'asset_status',    label: 'Status',        type: 'select', options: HARDWARE_STATUSES },
    { key: 'emp_code',        label: 'Employee code', type: 'text' },
    { key: 'emp_name',        label: 'Employee name', type: 'text' },
    { key: 'department',      label: 'Department',    type: 'text' },
    { key: 'purchase_date',   label: 'Purchase date', type: 'date' },
    { key: 'purchase_price',  label: 'Purchase price', type: 'number' },
    { key: 'warranty_expiry', label: 'Warranty expiry', type: 'date' },
    { key: 'remarks',         label: 'Remarks',       type: 'textarea' },
  ],
  software: [
    { key: 'software_name',     label: 'Software name',    type: 'text', required: true },
    { key: 'license_key',       label: 'License key',      type: 'text' },
    { key: 'subscription_type', label: 'Subscription type', type: 'text' },
    { key: 'account_email',     label: 'Account email',    type: 'email' },
    { key: 'expiry_date',       label: 'Expiry date',      type: 'date' },
    { key: 'branch_code',       label: 'Branch',           type: 'branch' },
    { key: 'emp_code',          label: 'Employee code',    type: 'text' },
    { key: 'emp_name',          label: 'Employee name',    type: 'text' },
    { key: 'department',        label: 'Department',       type: 'text' },
    { key: 'remarks',           label: 'Remarks',          type: 'textarea' },
  ],
  network: [
    { key: 'category',          label: 'Category',      type: 'assetType', required: true },
    { key: 'vendor',            label: 'Vendor',        type: 'text' },
    { key: 'model',             label: 'Model',         type: 'text' },
    { key: 'ip_address',        label: 'IP address',    type: 'text', keyboardType: 'numeric', placeholder: '192.168.1.10' },
    { key: 'mac_address',       label: 'MAC address',   type: 'text', autoCapitalize: 'characters' },
    { key: 'serial_number',     label: 'Serial number', type: 'text', autoCapitalize: 'characters' },
    { key: 'branch_code',       label: 'Branch',        type: 'branch' },
    { key: 'location',          label: 'Location',      type: 'text' },
    { key: 'enable_monitoring', label: 'Monitor this device', type: 'switch' },
    { key: 'remarks',           label: 'Remarks',       type: 'textarea' },
  ],
};
FIELDS.fixed = FIELDS.hardware;

// The asset-types category to offer per kind. Network devices use their own
// `category` column, whose values come from the network asset-type category.
const TYPE_CATEGORY = {
  hardware: 'hardware',
  fixed:    'fixed',
  software: 'software',
  network:  'network',
};

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// The server validates dates with Date.parse, which accepts far too much
// ("2" parses). Requiring ISO keeps what we send unambiguous.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const AssetFormScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const kind = route?.params?.kind || 'hardware';
  const existing = route?.params?.asset || null;
  const presetBranch = route?.params?.branch || null;
  const isEdit = !!existing?.id;

  const fields = FIELDS[kind] || FIELDS.hardware;
  const myBranches = user?.branches || [];

  const [values, setValues] = useState(() => {
    const seed = {};
    fields.forEach((f) => {
      const v = existing?.[f.key];
      if (f.type === 'switch') seed[f.key] = !!v;
      else if (v !== undefined && v !== null) {
        // Dates arrive as ISO timestamps; the inputs want just the day part.
        seed[f.key] = f.type === 'date' ? String(v).slice(0, 10) : String(v);
      } else {
        seed[f.key] = f.type === 'switch' ? false : '';
      }
    });
    if (!isEdit && presetBranch?.branch_code) seed.branch_code = presetBranch.branch_code;
    return seed;
  });

  const [assetTypes, setAssetTypes] = useState([]);
  const [picker, setPicker] = useState(null);   // field currently being picked
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    getAssetTypes(TYPE_CATEGORY[kind])
      .then((list) => { if (!cancelled) setAssetTypes(list.map((t) => t.name)); })
      .catch(() => { /* picker falls back to free text */ });
    return () => { cancelled = true; };
  }, [kind]);

  const setValue = useCallback((key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));
  }, []);

  const branchOptions = useMemo(
    () => myBranches.map((b) => ({
      value: b.branch_code,
      label: b.branch_code,
      sub: b.branch_name,
      name: b.branch_name,
    })),
    [myBranches],
  );

  const optionsFor = useCallback((field) => {
    if (field.type === 'branch') return branchOptions;
    if (field.type === 'assetType') {
      return assetTypes.map((n) => ({ value: n, label: n }));
    }
    return (field.options || []).map((o) => ({ value: o, label: o }));
  }, [assetTypes, branchOptions]);

  const validate = useCallback(() => {
    const found = {};
    fields.forEach((f) => {
      const v = values[f.key];
      if (f.required && isBlank(v)) {
        found[f.key] = 'Required';
        return;
      }
      if (f.type === 'date' && !isBlank(v) && !ISO_DATE.test(String(v).trim())) {
        found[f.key] = 'Use YYYY-MM-DD';
      }
      if (f.type === 'number' && !isBlank(v) && Number.isNaN(Number(v))) {
        found[f.key] = 'Must be a number';
      }
      if (f.type === 'email' && !isBlank(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) {
        found[f.key] = 'Not a valid email';
      }
    });
    setErrors(found);
    return Object.keys(found).length === 0;
  }, [fields, values]);

  const submit = useCallback(async () => {
    if (!validate()) {
      Alert.alert('Check the form', 'Some fields need attention.');
      return;
    }

    const writer = ASSET_WRITERS[kind];
    if (!writer) {
      Alert.alert('Not supported', `Cannot save ${kind} assets.`);
      return;
    }

    // Blank text fields go as null rather than '' so the server's transforms
    // and nullable columns see an actual absence of value.
    const cleaned = {};
    fields.forEach((f) => {
      const v = values[f.key];
      if (f.type === 'switch') cleaned[f.key] = !!v;
      else if (isBlank(v)) cleaned[f.key] = null;
      else if (f.type === 'number') cleaned[f.key] = Number(v);
      else cleaned[f.key] = String(v).trim();
    });

    // Keep branch_name consistent with the chosen code — hardware and software
    // both store a denormalised copy.
    if (cleaned.branch_code) {
      const match = branchOptions.find((b) => b.value === cleaned.branch_code);
      if (match?.name && 'branch_code' in cleaned) cleaned.branch_name = match.name;
    }

    setSaving(true);
    try {
      if (isEdit) {
        // Hardware and fixed assets must not lose the columns this form does
        // not show — see the note at the top of the file.
        const payload = (kind === 'hardware' || kind === 'fixed')
          ? buildHardwarePayload(existing, cleaned)
          : { ...existing, ...cleaned };
        await writer.update(existing.id, payload);
      } else {
        await writer.create(cleaned);
      }
      Alert.alert(
        isEdit ? 'Saved' : 'Created',
        `The ${KIND_TITLES[kind] || 'asset'} was ${isEdit ? 'updated' : 'created'}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      // A 403 here is a role permission, not a bad form — say so plainly.
      const msg = err?.message || 'Could not save.';
      Alert.alert(
        /denied|permission|forbidden/i.test(msg) ? 'Not permitted' : 'Save failed',
        msg,
      );
    } finally {
      setSaving(false);
    }
  }, [validate, kind, fields, values, isEdit, existing, navigation, branchOptions]);

  const renderField = (field) => {
    const err = errors[field.key];
    const v = values[field.key];

    if (field.type === 'switch') {
      return (
        <View key={field.key} style={styles.switchRow}>
          <Text style={styles.label}>{field.label}</Text>
          <Switch
            value={!!v}
            onValueChange={(next) => setValue(field.key, next)}
            trackColor={{ true: C.primary, false: C.border }}
          />
        </View>
      );
    }

    const isPicked = ['branch', 'assetType', 'select'].includes(field.type);

    return (
      <View key={field.key} style={styles.field}>
        <Text style={styles.label}>
          {field.label}
          {field.required && <Text style={styles.req}> *</Text>}
        </Text>

        {isPicked ? (
          <TouchableOpacity
            style={[styles.input, styles.pickerInput, err && styles.inputError]}
            onPress={() => setPicker(field)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pickerText, isBlank(v) && styles.placeholder]}>
              {isBlank(v) ? `Select ${field.label.toLowerCase()}` : String(v)}
            </Text>
            <ChevronDown color={C.textDim} size={16} />
          </TouchableOpacity>
        ) : (
          <TextInput
            style={[
              styles.input,
              field.type === 'textarea' && styles.textarea,
              err && styles.inputError,
            ]}
            value={String(v ?? '')}
            onChangeText={(t) => setValue(field.key, t)}
            placeholder={field.placeholder || (field.type === 'date' ? 'YYYY-MM-DD' : '')}
            placeholderTextColor={C.textDim}
            autoCapitalize={field.autoCapitalize || 'sentences'}
            autoCorrect={false}
            keyboardType={
              field.type === 'number' ? 'decimal-pad'
                : field.type === 'email' ? 'email-address'
                  : field.keyboardType || 'default'
            }
            multiline={field.type === 'textarea'}
          />
        )}

        {!!err && <Text style={styles.error}>{err}</Text>}
      </View>
    );
  };

  const pickerOptions = picker ? optionsFor(picker) : [];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="auto" />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft color={CHROME.text} size={22} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isEdit ? 'Edit' : 'New'} {KIND_TITLES[kind] || 'asset'}
            </Text>
            {isEdit && !!(existing.item_id || existing.serial_number) && (
              <Text style={styles.headerSub} numberOfLines={1}>
                {existing.item_id || existing.serial_number}
              </Text>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {fields.map(renderField)}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, S.md) }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={C.white} size="small" />
              : <><Save color={C.white} size={16} /><Text style={styles.saveText}>{isEdit ? 'Save changes' : 'Create asset'}</Text></>}
          </TouchableOpacity>
        </View>

        <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>{picker?.label}</Text>
                <TouchableOpacity onPress={() => setPicker(null)} activeOpacity={0.7}>
                  <XIcon color={C.textDim} size={18} />
                </TouchableOpacity>
              </View>

              {pickerOptions.length === 0 ? (
                <Text style={styles.emptyPicker}>
                  Nothing to choose from. Close this and type the value instead.
                </Text>
              ) : (
                <FlatList
                  data={pickerOptions}
                  keyExtractor={(o) => String(o.value)}
                  style={{ maxHeight: 380 }}
                  renderItem={({ item }) => {
                    const active = String(values[picker.key]) === String(item.value);
                    return (
                      <TouchableOpacity
                        style={styles.optionRow}
                        activeOpacity={0.7}
                        onPress={() => { setValue(picker.key, item.value); setPicker(null); }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionLabel, active && { color: C.primary }]}>
                            {item.label}
                          </Text>
                          {!!item.sub && <Text style={styles.optionSub} numberOfLines={1}>{item.sub}</Text>}
                        </View>
                        {active && <Check color={C.primary} size={16} />}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = themed(() => ({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: S.md,
    backgroundColor: CHROME.bg,
    borderBottomWidth: 1, borderBottomColor: CHROME.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: R.sm,
    backgroundColor: CHROME.buttonBg, borderWidth: 1, borderColor: CHROME.buttonBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: CHROME.text },
  headerSub:   { fontSize: 11, color: CHROME.textDim, marginTop: 1 },

  field:  { marginBottom: S.lg },
  label:  { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4, marginBottom: S.xs, textTransform: 'uppercase' },
  req:    { color: C.primary },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: R.sm,
    backgroundColor: C.surface, color: C.text,
    paddingHorizontal: S.md, paddingVertical: S.sm + 2, fontSize: 14,
  },
  textarea:    { minHeight: 82, textAlignVertical: 'top' },
  inputError:  { borderColor: C.offline },
  pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText:  { fontSize: 14, color: C.text, flex: 1 },
  placeholder: { color: C.textDim },
  error:       { fontSize: 11, color: C.offline, marginTop: 4 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: S.lg, paddingVertical: S.xs,
  },

  footer: {
    paddingHorizontal: S.lg, paddingTop: S.md,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    height: 48, borderRadius: R.sm, backgroundColor: C.primary,
  },
  saveText: { fontSize: 14, fontWeight: '800', color: C.white },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg,
    paddingBottom: S.xl, ...elevation(3),
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.lg, paddingVertical: S.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: C.text },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  optionLabel: { fontSize: 13, fontWeight: '600', color: C.text },
  optionSub:   { fontSize: 11, color: C.textMuted, marginTop: 1 },
  emptyPicker: { padding: S.lg, fontSize: 12, color: C.textMuted, textAlign: 'center' },
}));

export default AssetFormScreen;
