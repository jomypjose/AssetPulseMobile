package com.assetpulse.monitor

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.assetpulse.monitor.ui.SessionViewModel
import com.assetpulse.monitor.ui.nav.AppNavHost
import com.assetpulse.monitor.ui.theme.AssetPulseTheme
import com.assetpulse.monitor.ui.theme.DarkColors
import dagger.hilt.android.AndroidEntryPoint

/**
 * Single activity host.
 *
 * Extends [FragmentActivity] because androidx BiometricPrompt attaches its
 * prompt to a FragmentActivity.
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    private val sessionViewModel: SessionViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val session by sessionViewModel.state.collectAsStateWithLifecycle()
            val themeMode by sessionViewModel.themeMode.collectAsStateWithLifecycle()

            AssetPulseTheme(mode = themeMode) {
                if (session.isLoading) {
                    // Bootstrap is a couple of disk reads; hold the splash
                    // colour rather than flashing an empty auth screen.
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(DarkColors.bg)
                    )
                } else {
                    // The nav graph picks its start destination from the auth
                    // gate, so it has to be rebuilt when the gate's outcome
                    // changes (sign in, sign out, lock, server reset).
                    val gate = listOf(
                        session.isServerConfigured,
                        session.hasToken,
                        session.biometricLocked,
                    ).joinToString("|")

                    key(gate) {
                        AppNavHost(
                            session = session,
                            onServerConfigured = sessionViewModel::onServerSaved,
                            onLoggedIn = sessionViewModel::onLoggedIn,
                            onBiometricUnlocked = sessionViewModel::onBiometricUnlocked,
                            onSignOut = sessionViewModel::logout,
                            onServerCleared = sessionViewModel::clearServer,
                        )
                    }
                }
            }
        }
    }
}
