package com.assetpulse.monitor.ui.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.assetpulse.monitor.ui.SessionState
import com.assetpulse.monitor.ui.components.PlaceholderScreen
import com.assetpulse.monitor.ui.screens.auth.BiometricLockScreen
import com.assetpulse.monitor.ui.screens.auth.LoginScreen
import com.assetpulse.monitor.ui.screens.auth.ServerSetupScreen
import com.assetpulse.monitor.data.model.User

/**
 * Root navigation.
 *
 * The auth gate is expressed by choosing the start destination from
 * [SessionState] and re-keying the host when it changes, rather than by
 * pushing/popping — the same "the navigator renders whichever branch the
 * session is in" model the RN app used.
 */
@Composable
fun AppNavHost(
    session: SessionState,
    onLoggedIn: (User) -> Unit,
    onServerConfigured: (String) -> Unit,
    onBiometricUnlocked: () -> Unit,
    onSignOut: () -> Unit,
    onServerCleared: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    val startDestination = when {
        !session.isServerConfigured -> Routes.SERVER_SETUP
        session.hasToken && session.biometricLocked -> Routes.BIOMETRIC_LOCK
        session.hasToken -> Routes.MAIN
        else -> Routes.LOGIN
    }

    NavHost(navController = navController, startDestination = startDestination) {

        composable(Routes.SERVER_SETUP) {
            ServerSetupScreen(onConfigured = onServerConfigured)
        }

        composable(Routes.LOGIN) {
            LoginScreen(
                serverUrl = session.serverUrl,
                onLoggedIn = onLoggedIn,
                onServerCleared = onServerCleared,
            )
        }

        composable(Routes.BIOMETRIC_LOCK) {
            BiometricLockScreen(
                onUnlocked = onBiometricUnlocked,
                onSignOut = onSignOut,
            )
        }

        // ── Main shell ────────────────────────────────────────────────────
        // Phase 1 replaces this with the five-tab scaffold; the surrounding
        // auth gate and every route below are already wired.
        composable(Routes.MAIN) {
            PlaceholderScreen("Dashboard", "Phase 1")
        }

        composable(Routes.DEVICES) { PlaceholderScreen("Devices", "Phase 1") }
        composable(Routes.DEVICE_DETAIL) { PlaceholderScreen("Device detail", "Phase 1") }
        composable(Routes.ALERTS) { PlaceholderScreen("Alerts", "Phase 1") }

        composable(Routes.BRANCHES) { PlaceholderScreen("Branches", "Phase 2") }
        composable(Routes.BRANCH_DETAIL) { PlaceholderScreen("Branch detail", "Phase 2") }
        composable(Routes.BRANCH_ASSETS) { PlaceholderScreen("Branch assets", "Phase 2") }
        composable(Routes.ASSET_DETAIL) { PlaceholderScreen("Asset detail", "Phase 2") }
        composable(Routes.ASSET_FORM) { PlaceholderScreen("Asset form", "Phase 2") }
        composable(Routes.SCANNER) { PlaceholderScreen("Scanner", "Phase 2") }
        composable(Routes.EXPIRY) { PlaceholderScreen("Expiry", "Phase 2") }

        composable(Routes.TICKETS) { PlaceholderScreen("Tickets", "Phase 3") }
        composable(Routes.DAILY_JOBS) { PlaceholderScreen("Daily jobs", "Phase 3") }
        composable(Routes.SEARCH) { PlaceholderScreen("Search", "Phase 3") }

        composable(Routes.MESSAGES) { PlaceholderScreen("Messages", "Phase 4") }
        composable(Routes.CHAT) { PlaceholderScreen("Chat", "Phase 4") }

        composable(Routes.PROFILE) { PlaceholderScreen("Profile", "Phase 5") }
        composable(Routes.MAP) { PlaceholderScreen("Map", "Phase 5") }
    }
}
