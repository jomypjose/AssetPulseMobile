package com.assetpulse.monitor.tracking

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.Looper
import android.os.StatFs
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.assetpulse.monitor.MainActivity
import com.assetpulse.monitor.R
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Foreground service that reports this device's location and system health to
 * AssetPulse, so an organization-assigned phone or tablet shows up on the
 * tracking map like any other asset.
 *
 * Adapted from `agent/mobile/LocationTrackingService.kt` in the AssetPulse
 * server repo. Differences from that reference, all deliberate:
 *
 *  - Uses its own bare [OkHttpClient]. `/tracking/agent/ping` authenticates
 *    with the agent token in the body, not the user's session, so it must not
 *    go through the app's auth interceptor.
 *  - `startForeground` declares `FOREGROUND_SERVICE_TYPE_LOCATION`, which is
 *    mandatory from Android 14 and we target 36.
 *  - Reads its configuration from [TrackingPreferences] when the intent has
 *    none, so a restart by the system (START_STICKY) or the boot receiver
 *    recovers without re-enrollment.
 *  - `Build.SERIAL` returns "unknown" on API 26+, so the serial recorded at
 *    enrollment is used instead of reading it here.
 *  - The coroutine scope is cancelled in onDestroy; the reference leaked it.
 */
class LocationTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private lateinit var prefs: TrackingPreferences

    private var serverUrl: String = ""
    private var agentToken: String = ""
    private var serialNumber: String = ""
    private var intervalMs: Long = TrackingPreferences.DEFAULT_INTERVAL_MS

    override fun onCreate() {
        super.onCreate()
        prefs = TrackingPreferences(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Fall back to stored enrollment: on a START_STICKY restart the system
        // replays a null intent, and the boot receiver has no extras to give.
        serverUrl = intent?.getStringExtra(EXTRA_SERVER_URL) ?: prefs.serverUrl.orEmpty()
        agentToken = intent?.getStringExtra(EXTRA_AGENT_TOKEN) ?: prefs.agentToken.orEmpty()
        serialNumber = intent?.getStringExtra(EXTRA_SERIAL_NUMBER) ?: prefs.serialNumber.orEmpty()
        intervalMs = intent?.getLongExtra(EXTRA_INTERVAL_MS, prefs.intervalMs)
            ?: prefs.intervalMs

        if (serverUrl.isBlank() || agentToken.isBlank()) {
            Log.w(TAG, "No enrollment available; stopping.")
            stopSelf()
            return START_NOT_STICKY
        }

        startAsForeground()
        startLocationUpdates()
        return START_STICKY
    }

    private fun startAsForeground() {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildForegroundNotification(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            } else {
                0
            },
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Asset tracking",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Reports this device's location to AssetPulse asset management"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildForegroundNotification(): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val label = prefs.assetLabel

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Asset tracking is on")
            // Say plainly what is being collected — the person holding the
            // device should not have to guess.
            .setContentText(
                label?.let { "Sharing location with AssetPulse as $it" }
                    ?: "Sharing this device's location with AssetPulse"
            )
            .setSmallIcon(R.drawable.ic_tracking)
            .setContentIntent(openApp)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }

        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMaxUpdateDelayMillis(intervalMs)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                sendTelemetry(location)
            }
        }
        locationCallback = callback

        runCatching {
            fusedLocationClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
        }.onFailure {
            // Permission revoked while running, or Play Services unavailable.
            Log.e(TAG, "Could not start location updates", it)
            stopSelf()
        }
    }

    private fun sendTelemetry(location: Location) {
        serviceScope.launch {
            try {
                val payload = JSONObject().apply {
                    put("agent_token", agentToken)
                    if (serialNumber.isNotBlank()) put("serial_number", serialNumber)
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("accuracy", location.accuracy)
                    put("altitude", location.altitude)
                    put("speed", location.speed)
                    put("heading", location.bearing)
                    batteryPercent()?.let { put("battery_level", it) }
                    put("is_charging", isCharging())
                    ramUsagePercent()?.let { put("ram_usage", it) }
                    diskUsagePercent()?.let { put("disk_usage", it) }
                    put("uptime", uptimeLabel())
                    put("location_source", "gps")
                    put("os_name", "Android")
                    put("os_version", Build.VERSION.RELEASE)
                }

                val request = Request.Builder()
                    .url(TrackingPreferences.pingUrl(serverUrl))
                    .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                httpClient.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        Log.d(TAG, "Ping accepted (${response.code})")
                    } else {
                        Log.w(TAG, "Ping rejected: ${response.code} ${response.message}")
                    }
                }
            } catch (e: Exception) {
                // Losing a ping is normal on a moving device; the next tick retries.
                Log.e(TAG, "Failed to send telemetry", e)
            }
        }
    }

    private fun batteryStatusIntent(): Intent? =
        registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

    private fun batteryPercent(): Int? {
        val status = batteryStatusIntent() ?: return null
        val level = status.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = status.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        return if (level >= 0 && scale > 0) level * 100 / scale else null
    }

    private fun isCharging(): Boolean {
        val status = batteryStatusIntent()?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        return status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
    }

    private fun ramUsagePercent(): Int? {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return null
        val info = ActivityManager.MemoryInfo()
        manager.getMemoryInfo(info)
        if (info.totalMem <= 0) return null
        return ((info.totalMem - info.availMem) * 100.0 / info.totalMem).toInt()
    }

    private fun diskUsagePercent(): Int? = runCatching {
        val stat = StatFs(Environment.getDataDirectory().path)
        if (stat.totalBytes <= 0) return@runCatching null
        ((stat.totalBytes - stat.availableBytes) * 100.0 / stat.totalBytes).toInt()
    }.getOrNull()

    /** Matches the "53d 9h 12m" shape the server already stores for devices. */
    private fun uptimeLabel(): String {
        val seconds = SystemClock.elapsedRealtime() / 1000
        val days = seconds / 86_400
        val hours = (seconds % 86_400) / 3_600
        val minutes = (seconds % 3_600) / 60
        return if (days > 0) "${days}d ${hours}h ${minutes}m" else "${hours}h ${minutes}m"
    }

    override fun onDestroy() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "AssetPulseTracking"
        private const val CHANNEL_ID = "assetpulse_tracking_channel"
        private const val NOTIFICATION_ID = 1001

        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        const val EXTRA_SERVER_URL = "extra_server_url"
        const val EXTRA_AGENT_TOKEN = "extra_agent_token"
        const val EXTRA_SERIAL_NUMBER = "extra_serial_number"
        const val EXTRA_INTERVAL_MS = "extra_interval_ms"

        fun start(
            context: Context,
            serverUrl: String,
            agentToken: String,
            serialNumber: String? = null,
            intervalMs: Long = TrackingPreferences.DEFAULT_INTERVAL_MS,
        ) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                putExtra(EXTRA_SERVER_URL, serverUrl)
                putExtra(EXTRA_AGENT_TOKEN, agentToken)
                putExtra(EXTRA_SERIAL_NUMBER, serialNumber)
                putExtra(EXTRA_INTERVAL_MS, intervalMs)
            }
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }.onFailure { Log.e(TAG, "Could not start tracking service", it) }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, LocationTrackingService::class.java))
        }
    }
}
