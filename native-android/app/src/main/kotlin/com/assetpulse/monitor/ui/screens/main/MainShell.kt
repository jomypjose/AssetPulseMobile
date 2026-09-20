package com.assetpulse.monitor.ui.screens.main

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.ui.components.PlaceholderScreen
import com.assetpulse.monitor.ui.nav.Routes
import com.assetpulse.monitor.ui.screens.alerts.AlertsScreen
import com.assetpulse.monitor.ui.screens.dashboard.DashboardScreen
import com.assetpulse.monitor.ui.screens.devices.DeviceDetailScreen
import com.assetpulse.monitor.ui.screens.devices.DevicesScreen
import com.assetpulse.monitor.ui.screens.profile.ProfileScreen
import com.assetpulse.monitor.ui.screens.tracking.TrackingScreen
import com.assetpulse.monitor.ui.theme.Chrome
import com.assetpulse.monitor.ui.util.PollIntervals
import com.assetpulse.monitor.ui.util.PollingEffect

private data class Tab(
    val route: String,
    val label: String,
    val icon: ImageVector,
)

private val TABS = listOf(
    Tab(Routes.DASHBOARD, "Dashboard", Icons.Filled.Dashboard),
    Tab(Routes.DEVICES, "Devices", Icons.Filled.Dns),
    Tab(Routes.ALERTS, "Alerts", Icons.Filled.Notifications),
    Tab(Routes.MESSAGES, "Messages", Icons.AutoMirrored.Filled.Message),
    Tab(Routes.PROFILE, "Profile", Icons.Filled.AccountCircle),
)

/**
 * The signed-in shell: five bottom tabs over a nested nav graph.
 *
 * The bottom bar uses the always-dark [Chrome] palette regardless of the
 * app's light/dark setting, matching the RN app and the web sidebar.
 */
@Composable
fun MainShell(
    user: User?,
    serverUrl: String?,
    onSignOut: () -> Unit,
    badgeViewModel: BadgeViewModel = hiltViewModel(),
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val badges by badgeViewModel.state.collectAsStateWithLifecycle()

    PollingEffect(intervalMs = PollIntervals.BADGE_MS) { badgeViewModel.refresh() }

    Scaffold(
        containerColor = com.assetpulse.monitor.ui.theme.AppTheme.colors.bg,
        bottomBar = {
            NavigationBar(containerColor = Chrome.bg) {
                TABS.forEach { tab ->
                    val selected = backStackEntry?.destination?.hierarchy
                        ?.any { it.route == tab.route } == true
                    val badgeCount = when (tab.route) {
                        Routes.ALERTS -> badges.unacknowledgedAlerts
                        Routes.MESSAGES -> badges.unreadMessages
                        else -> 0
                    }

                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(tab.route) {
                                // Standard bottom-nav behaviour: one entry per
                                // tab, state preserved when switching back.
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            BadgedBox(
                                badge = {
                                    if (badgeCount > 0) {
                                        Badge { Text(badgeCount.coerceAtMost(99).toString()) }
                                    }
                                },
                            ) {
                                Icon(tab.icon, contentDescription = tab.label)
                            }
                        },
                        label = { Text(tab.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = com.assetpulse.monitor.ui.theme.AppTheme.colors.primary,
                            selectedTextColor = com.assetpulse.monitor.ui.theme.AppTheme.colors.primary,
                            unselectedIconColor = Chrome.textMuted,
                            unselectedTextColor = Chrome.textMuted,
                            indicatorColor = Chrome.buttonBg,
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.DASHBOARD,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(Routes.DASHBOARD) {
                DashboardScreen(
                    userName = user?.displayName?.takeIf { it.isNotBlank() } ?: "there",
                    onOpenDevices = { navController.navigate(Routes.DEVICES) },
                    onOpenAlerts = { navController.navigate(Routes.ALERTS) },
                    onOpenDevice = { navController.navigate(Routes.deviceDetail(it)) },
                )
            }

            composable(Routes.DEVICES) {
                DevicesScreen(onOpenDevice = { navController.navigate(Routes.deviceDetail(it)) })
            }

            composable(Routes.DEVICE_DETAIL) {
                DeviceDetailScreen(onBack = { navController.popBackStack() })
            }

            composable(Routes.ALERTS) { AlertsScreen() }

            composable(Routes.MESSAGES) { PlaceholderScreen("Messages", "Phase 4") }

            composable(Routes.PROFILE) {
                ProfileScreen(
                    user = user,
                    serverUrl = serverUrl,
                    onOpenTracking = { navController.navigate(Routes.TRACKING) },
                    onSignOut = onSignOut,
                )
            }

            composable(Routes.TRACKING) {
                TrackingScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
