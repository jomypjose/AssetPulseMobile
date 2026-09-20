package com.assetpulse.monitor.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class LoginResponse(
    val token: String? = null,
    @SerialName("refreshToken") val refreshToken: String? = null,
    val user: User? = null,
)

@Serializable
data class RefreshRequest(
    @SerialName("refreshToken") val refreshToken: String,
)

@Serializable
data class RefreshResponse(
    val token: String? = null,
    @SerialName("refreshToken") val refreshToken: String? = null,
)

@Serializable
data class LogoutRequest(
    @SerialName("refreshToken") val refreshToken: String? = null,
)

@Serializable
data class PushTokenRequest(
    val token: String,
)

@Serializable
data class User(
    val id: Int? = null,
    val username: String? = null,
    @SerialName("full_name") val fullName: String? = null,
    val role: String? = null,
    @SerialName("profile_picture") val profilePicture: String? = null,
    val branches: List<UserBranch> = emptyList(),
) {
    /** Role gating as used in TicketsHubScreen.js. */
    val isAdmin: Boolean
        get() = role in setOf("admin", "super_admin", "admin_staff")

    val isTechnician: Boolean
        get() = isAdmin || role == "technician"

    val displayName: String
        get() = fullName?.takeIf { it.isNotBlank() } ?: username.orEmpty()
}

@Serializable
data class UserBranch(
    @SerialName("branch_code") val branchCode: String? = null,
    @SerialName("branch_name") val branchName: String? = null,
)

@Serializable
data class ProfileResponse(
    val user: User? = null,
)
