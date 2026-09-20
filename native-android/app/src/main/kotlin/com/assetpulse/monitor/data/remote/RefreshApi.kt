package com.assetpulse.monitor.data.remote

import com.assetpulse.monitor.data.model.RefreshRequest
import com.assetpulse.monitor.data.model.RefreshResponse
import retrofit2.http.Body
import retrofit2.http.Headers
import retrofit2.http.POST

/**
 * Refresh endpoint on its own Retrofit instance, backed by a client with no
 * auth interceptor and no authenticator — so a failing refresh can never
 * trigger another refresh. Equivalent to the RN client calling `/auth/refresh`
 * with a raw axios instance instead of the interceptor-wrapped one.
 */
interface RefreshApi {

    @Headers("$HEADER_NO_AUTH: true")
    @POST("/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): RefreshResponse
}
