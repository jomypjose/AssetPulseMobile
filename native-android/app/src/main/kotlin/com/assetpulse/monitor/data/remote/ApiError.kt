package com.assetpulse.monitor.data.remote

import org.json.JSONObject
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/** A failed API call, already reduced to a message fit to show the user. */
class ApiException(
    message: String,
    val statusCode: Int? = null,
    cause: Throwable? = null,
) : Exception(message, cause)

/**
 * Normalises throwables into [ApiException], following the same precedence the
 * RN client used: `response.data.message` -> `response.data.error` ->
 * the transport error's own message -> a generic fallback.
 */
fun Throwable.toApiException(): ApiException = when (this) {
    is ApiException -> this

    is HttpException -> {
        val body = runCatching { response()?.errorBody()?.string() }.getOrNull()
        val parsed = body?.let { raw ->
            runCatching {
                val obj = JSONObject(raw)
                obj.optString("message").takeIf { it.isNotBlank() }
                    ?: obj.optString("error").takeIf { it.isNotBlank() }
            }.getOrNull()
        }
        ApiException(parsed ?: message(), statusCode = code(), cause = this)
    }

    is UnknownHostException ->
        ApiException("Can't reach the server. Check the address and your connection.", cause = this)

    is SocketTimeoutException ->
        ApiException("The server took too long to respond.", cause = this)

    is IOException ->
        ApiException(message ?: "Network error. Check your connection.", cause = this)

    else -> ApiException(message ?: "An unexpected error occurred", cause = this)
}
