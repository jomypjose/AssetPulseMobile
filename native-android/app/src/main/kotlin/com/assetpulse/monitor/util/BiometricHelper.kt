package com.assetpulse.monitor.util

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Biometric app-lock — the native counterpart of
 * `src/services/BiometricService.js`.
 *
 * Fails closed, exactly as the RN service did: any error during the prompt
 * denies the unlock. The only case that skips the prompt is hardware that
 * genuinely cannot authenticate, since the lock could not have been enabled
 * on such a device in the first place.
 */
object BiometricHelper {

    private const val ALLOWED_AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_WEAK or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL

    fun isAvailable(activity: FragmentActivity): Boolean =
        BiometricManager.from(activity)
            .canAuthenticate(ALLOWED_AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

    suspend fun authenticate(
        activity: FragmentActivity,
        title: String = "Unlock AssetPulse",
        subtitle: String? = null,
    ): Boolean {
        if (!isAvailable(activity)) return false

        return suspendCancellableCoroutine { continuation ->
            val executor = androidx.core.content.ContextCompat.getMainExecutor(activity)
            val prompt = BiometricPrompt(
                activity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        if (continuation.isActive) continuation.resume(true)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        // Fail closed on every error, including user cancel.
                        if (continuation.isActive) continuation.resume(false)
                    }

                    // onAuthenticationFailed (a rejected finger) is not terminal;
                    // the prompt stays up and the user can retry.
                },
            )

            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .apply { subtitle?.let { setSubtitle(it) } }
                .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
                .build()

            prompt.authenticate(info)
            continuation.invokeOnCancellation { prompt.cancelAuthentication() }
        }
    }
}
