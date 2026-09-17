// ─────────────────────────────────────────────────────────────────────────────
// QR verification — "is this asset where the system thinks it is?"
//
// Two paths, chosen automatically:
//
//   AUDIT    An audit is IN_PROGRESS for the branch. Scanning marks that
//            asset's checklist item FOUND. An asset the snapshot didn't
//            expect is recorded as a surplus finding, leaving the asset
//            record untouched — the audit's approval step decides what to do
//            about it. This is the auditable path and is preferred.
//
//   DIRECT   No audit running. Scanning either confirms the asset is already
//            recorded at this branch, or offers to move its branch_code here.
//
// ── Why relocation sends the whole asset back ────────────────────────────────
// PUT /hardware/:id is NOT a safe partial update. The server's
// hardwareService.updateAsset() unconditionally writes in_date, out_date,
// purchase_date, warranty_expiry and asset_status, and it runs every date
// through parseDate(), which maps undefined → null. So a tidy-looking
// { branch_code } patch silently erases four dates and rewrites the status.
// Every write here therefore echoes the asset's current values back alongside
// the change.
// ─────────────────────────────────────────────────────────────────────────────
import {
  getActiveAuditForBranch,
  getAuditItems,
  updateAuditItem,
  addAuditSurplusItem,
  updateHardwareAsset,
} from './api';

/**
 * Mobile asset kind → the category the server stores in audit_items.asset_type.
 * Fixed assets live in hardware_assets, so they audit as 'hardware'. Software
 * is not snapshotted by startAudit at all, hence no entry: software scans skip
 * the audit path entirely.
 */
export const AUDIT_CATEGORY = {
  hardware: 'hardware',
  fixed:    'hardware',
  network:  'network',
};

/**
 * Fields hardwareService.updateAsset() will overwrite or derive if absent.
 * Echoing them keeps an edit to one field from clearing the rest.
 */
const HARDWARE_FIELDS = [
  'emp_code', 'emp_name', 'branch_code', 'branch_name', 'brand_name',
  'model_name', 'serial_number', 'in_date', 'out_date', 'department',
  'asset_type', 'asset_status', 'purchase_price', 'purchase_date',
  'useful_life_years', 'salvage_value', 'warranty_expiry', 'remarks',
  'po_number', 'invoice_number', 'vendor_id',
];

/**
 * Merge `changes` onto `asset`, carrying every field the server would
 * otherwise reset. Dates are passed through as-is (ISO strings from the API
 * satisfy the server's Date.parse validation).
 *
 * @param {object} asset    The asset as the server last returned it.
 * @param {object} changes  Only the fields being deliberately changed.
 */
export const buildHardwarePayload = (asset, changes = {}) => {
  const payload = {};
  HARDWARE_FIELDS.forEach((f) => {
    if (asset?.[f] !== undefined) payload[f] = asset[f];
  });
  return { ...payload, ...changes };
};

/**
 * Decide what a scan at `branchCode` means for `asset`. Read-only for the
 * direct path (the caller confirms before anything moves); the audit path
 * records FOUND immediately, since marking an asset present is not a
 * destructive act and making the user confirm each of hundreds of scans would
 * defeat the point.
 *
 * @param {object} params
 * @param {object} params.asset       Resolved asset record.
 * @param {string} params.kind        'hardware' | 'fixed' | 'network' | 'software'
 * @param {string} params.branchCode  Branch being verified.
 * @returns {Promise<object>} one of:
 *   { mode:'audit',  action:'found',     item, audit }
 *   { mode:'audit',  action:'surplus',   audit, serial }   — needs confirmation
 *   { mode:'direct', action:'confirmed', branchCode }
 *   { mode:'direct', action:'relocate',  from, to, asset } — needs confirmation
 *   { mode:'none',   action:'no-branch' }
 */
export const classifyScan = async ({ asset, kind, branchCode }) => {
  if (!branchCode) return { mode: 'none', action: 'no-branch' };

  const category = AUDIT_CATEGORY[kind];

  // ── Audit path ────────────────────────────────────────────────────────────
  // A failure here (no permission to view audits, server hiccup) must not
  // block verification — fall through to the direct path rather than dead-end.
  if (category) {
    let audit = null;
    try {
      audit = await getActiveAuditForBranch(branchCode);
    } catch { /* fall through to direct */ }

    if (audit) {
      try {
        const { items } = await getAuditItems(audit.id);
        // asset_id is only unique within a category — hardware #5 and
        // network #5 are different assets — so match on both.
        const item = items.find(
          (i) => i.asset_id === asset.id && i.asset_type === category,
        );

        if (item) {
          await updateAuditItem(item.id, 'FOUND');
          return { mode: 'audit', action: 'found', item, audit };
        }

        // Present but not in the snapshot: a surplus finding. The server
        // requires a serial number to record one.
        return {
          mode: 'audit',
          action: 'surplus',
          audit,
          serial: asset.serial_number || null,
        };
      } catch (err) {
        return { mode: 'audit', action: 'error', audit, error: err.message };
      }
    }
  }

  // ── Direct path ───────────────────────────────────────────────────────────
  const current = asset.branch_code || null;
  if (current && String(current) === String(branchCode)) {
    return { mode: 'direct', action: 'confirmed', branchCode };
  }
  return { mode: 'direct', action: 'relocate', from: current, to: branchCode, asset };
};

/**
 * Apply a confirmed relocation. Only hardware and fixed assets are supported:
 * network and software assets have their own update contracts which this
 * payload shape does not fit, and moving a network device between branches is
 * a topology change rather than a scan correction.
 *
 * @param {object} asset      Full asset record (needed for the merge).
 * @param {string} kind       'hardware' | 'fixed'
 * @param {string} branchCode Destination branch.
 * @param {string} [branchName]
 */
export const applyRelocation = async (asset, kind, branchCode, branchName) => {
  if (kind !== 'hardware' && kind !== 'fixed') {
    throw new Error(`Relocating ${kind} assets from the scanner is not supported.`);
  }
  const changes = { branch_code: branchCode };
  if (branchName) changes.branch_name = branchName;
  return updateHardwareAsset(asset.id, buildHardwarePayload(asset, changes));
};

/**
 * Record a surplus find against a running audit.
 * @param {object} audit
 * @param {object} asset
 * @param {string} kind
 */
export const recordSurplus = async (audit, asset, kind) => {
  const serial = asset.serial_number;
  if (!serial) {
    throw new Error('This asset has no serial number, which the audit needs to record a surplus find.');
  }
  return addAuditSurplusItem(audit.id, {
    serial_number: serial,
    asset_type: AUDIT_CATEGORY[kind] || 'hardware',
    remarks: `Scanned at ${audit.branch_code} — not in audit snapshot`,
  });
};
