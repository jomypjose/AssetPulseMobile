package com.assetpulse.monitor.data.remote

import com.assetpulse.monitor.data.model.LoginRequest
import com.assetpulse.monitor.data.model.LoginResponse
import com.assetpulse.monitor.data.model.LogoutRequest
import com.assetpulse.monitor.data.model.ProfileResponse
import com.assetpulse.monitor.data.model.PushTokenRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.PUT

/**
 * The AssetPulse REST surface.
 *
 * Grows one phase at a time; this is the Phase 0 (auth shell) subset. Paths
 * are relative to the user-configured server address, which
 * [HostSelectionInterceptor] applies at request time.
 */
interface AssetPulseApi {

    @Headers("$HEADER_NO_AUTH: true")
    @POST("/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("/auth/logout")
    suspend fun logout(@Body body: LogoutRequest): Unit

    @PUT("/auth/push-token")
    suspend fun registerPushToken(@Body body: PushTokenRequest): Unit

    @GET("/profile")
    suspend fun getProfile(): ProfileResponse
}
