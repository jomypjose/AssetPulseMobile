package com.assetpulse.monitor.data.local

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.ui.theme.ThemeMode
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "assetpulse_prefs")

/**
 * Non-secret persisted state — the native counterpart of the RN app's
 * AsyncStorage usage (`SERVER_URL_KEY`, `USER_STORAGE_KEY`, the theme
 * preference, and `@assetpulse_biometric_enabled`).
 *
 * Tokens deliberately do NOT live here; see [SecureTokenStore].
 */
@Singleton
class AppPreferences @Inject constructor(
    @ApplicationContext private val context: Context,
    private val json: Json,
) {
    val serverUrl: Flow<String?> = context.dataStore.data.map { it[KEY_SERVER_URL] }

    val themeMode: Flow<ThemeMode> =
        context.dataStore.data.map { ThemeMode.fromStored(it[KEY_THEME]) }

    val biometricEnabled: Flow<Boolean> =
        context.dataStore.data.map { it[KEY_BIOMETRIC] ?: false }

    val cachedUser: Flow<User?> = context.dataStore.data.map { prefs ->
        prefs[KEY_USER]?.let { runCatching { json.decodeFromString<User>(it) }.getOrNull() }
    }

    suspend fun currentServerUrl(): String? = context.dataStore.data.first()[KEY_SERVER_URL]

    suspend fun setServerUrl(url: String?) = edit { prefs ->
        if (url == null) prefs.remove(KEY_SERVER_URL) else prefs[KEY_SERVER_URL] = url
    }

    suspend fun setThemeMode(mode: ThemeMode) = edit { it[KEY_THEME] = mode.stored }

    suspend fun setBiometricEnabled(enabled: Boolean) = edit { it[KEY_BIOMETRIC] = enabled }

    suspend fun isBiometricEnabled(): Boolean =
        context.dataStore.data.first()[KEY_BIOMETRIC] ?: false

    suspend fun setUser(user: User?) = edit { prefs ->
        if (user == null) prefs.remove(KEY_USER) else prefs[KEY_USER] = json.encodeToString(User.serializer(), user)
    }

    suspend fun currentUser(): User? = context.dataStore.data.first()[KEY_USER]
        ?.let { runCatching { json.decodeFromString<User>(it) }.getOrNull() }

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.dataStore.edit(block)
    }

    private companion object {
        val KEY_SERVER_URL: Preferences.Key<String> = stringPreferencesKey("server_url")
        val KEY_USER: Preferences.Key<String> = stringPreferencesKey("user")
        val KEY_THEME: Preferences.Key<String> = stringPreferencesKey("theme_mode")
        val KEY_BIOMETRIC: Preferences.Key<Boolean> = booleanPreferencesKey("biometric_enabled")
    }
}
