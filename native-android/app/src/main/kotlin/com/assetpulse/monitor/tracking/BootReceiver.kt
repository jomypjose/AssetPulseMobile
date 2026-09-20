package com.assetpulse.monitor.tracking

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Resumes asset tracking after a reboot.
 *
 * Adapted from `agent/mobile/BootReceiver.kt`. Two additions over the
 * reference: it only restarts when the user actually left tracking enabled
 * (not merely enrolled once), and it re-checks the location permission, since
 * the user may have revoked it while the device was off — starting a
 * location foreground service without it would crash on newer Android.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }

        val prefs = TrackingPreferences(context)
        if (!prefs.enabled || !prefs.isEnrolled) return

        val hasLocation = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasLocation) {
            Log.w(TAG, "Location permission revoked; not resuming tracking after boot.")
            return
        }

        LocationTrackingService.start(
            context = context,
            serverUrl = prefs.serverUrl.orEmpty(),
            agentToken = prefs.agentToken.orEmpty(),
            serialNumber = prefs.serialNumber,
            intervalMs = prefs.intervalMs,
        )
    }

    private companion object {
        const val TAG = "AssetPulseTracking"
    }
}
