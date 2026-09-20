package com.assetpulse.monitor.data.remote

import com.assetpulse.monitor.data.model.AcknowledgeRequest
import com.assetpulse.monitor.data.model.AlertsResponse
import com.assetpulse.monitor.data.model.DashboardStats
import com.assetpulse.monitor.data.model.DeviceDetailResponse
import com.assetpulse.monitor.data.model.DeviceListResponse
import com.assetpulse.monitor.data.model.LoginRequest
import com.assetpulse.monitor.data.model.LoginResponse
import com.assetpulse.monitor.data.model.LogoutRequest
import com.assetpulse.monitor.data.model.MaintenanceRequest
import com.assetpulse.monitor.data.model.ProfileResponse
import com.assetpulse.monitor.data.model.PushTokenRequest
import kotlinx.serialization.json.JsonElement
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The AssetPulse REST surface.
 *
 * Grows one phase at a time; this covers Phases 0–1. Paths are relative to
 * the user-configured server address, which [HostSelectionInterceptor]
 * applies at request time.
 */
interface AssetPulseApi {

    // ── Auth ──────────────────────────────────────────────────────────────
    @Headers("$HEADER_NO_AUTH: true")
    @POST("/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("/auth/logout")
    suspend fun logout(@Body body: LogoutRequest)

    @PUT("/auth/push-token")
    suspend fun registerPushToken(@Body body: PushTokenRequest)

    @GET("/profile")
    suspend fun getProfile(): ProfileResponse

    // ── Dashboard ─────────────────────────────────────────────────────────
    @GET("/dashboard/stats")
    suspend fun getDashboardStats(): DashboardStats

    // ── Network devices ───────────────────────────────────────────────────
    /**
     * The device list is the `/network` asset list. The RN client asked for
     * limit=10000 and filtered client-side to rows with monitoring enabled,
     * because the endpoint has no "monitored only" flag.
     */
    @GET("/network")
    suspend fun getDevices(
        @Query("limit") limit: Int = 10_000,
        @Query("monitoring_status") monitoringStatus: String? = null,
    ): DeviceListResponse

    @GET("/network/{id}/detail")
    suspend fun getDeviceDetail(@Path("id") id: Int): DeviceDetailResponse

    /** Shape varies by server version; parsed leniently at the call site. */
    @GET("/network/{id}/metrics")
    suspend fun getDeviceMetrics(
        @Path("id") id: Int,
        @Query("range") range: String = "1h",
    ): JsonElement

    @PATCH("/network/{id}/maintenance")
    suspend fun setMaintenanceMode(
        @Path("id") id: Int,
        @Body body: MaintenanceRequest,
    )

    // ── Alerts ────────────────────────────────────────────────────────────
    @GET("/alerts")
    suspend fun getAlerts(@Query("severity") severity: String? = null): AlertsResponse

    @POST("/alerts/bulk-acknowledge")
    suspend fun acknowledgeAlerts(@Body body: AcknowledgeRequest)

    @PATCH("/alerts/{id}/acknowledge")
    suspend fun acknowledgeAlert(@Path("id") id: Int)

    @PATCH("/alerts/{id}/resolve")
    suspend fun resolveAlert(@Path("id") id: Int)
}
