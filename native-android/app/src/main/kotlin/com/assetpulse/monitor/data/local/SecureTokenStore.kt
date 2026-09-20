package com.assetpulse.monitor.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Keystore-backed storage for the access and refresh JWTs — the native
 * equivalent of `src/services/tokenStorage.js` (expo-secure-store).
 *
 * Tokens never touch plain SharedPreferences/DataStore. The RN app's
 * lazy migration from legacy plaintext AsyncStorage keys is deliberately
 * not ported: this is a fresh install with no legacy store to read.
 *
 * Reads/writes are synchronous SharedPreferences calls; they are cheap and
 * already memory-cached after first load, so callers on OkHttp's background
 * threads can use them directly.
 */
@Singleton
class SecureTokenStore @Inject constructor(
    @ApplicationContext context: Context,
) : TokenStore {
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override var accessToken: String?
        get() = prefs.getString(KEY_ACCESS, null)
        set(value) = prefs.edit().apply {
            if (value == null) remove(KEY_ACCESS) else putString(KEY_ACCESS, value)
        }.apply()

    override var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH, null)
        set(value) = prefs.edit().apply {
            if (value == null) remove(KEY_REFRESH) else putString(KEY_REFRESH, value)
        }.apply()

    override fun clear() {
        prefs.edit().remove(KEY_ACCESS).remove(KEY_REFRESH).apply()
    }

    private companion object {
        const val FILE_NAME = "assetpulse_secure_tokens"
        const val KEY_ACCESS = "assetpulse_token"
        const val KEY_REFRESH = "assetpulse_refresh_token"
    }
}
