package com.assetpulse.monitor.util

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * The API hands back ISO-8601 instants ("2026-09-20T13:43:49.475Z"). Showing
 * those raw is unreadable on a phone, so recent times become "5m ago" and
 * older ones a short local date.
 */
object Dates {

    private val SHORT = DateTimeFormatter.ofPattern("d MMM, HH:mm")

    fun relative(iso: String?, now: Instant = Instant.now()): String {
        val instant = parse(iso) ?: return "—"
        val elapsed = Duration.between(instant, now)

        // Clock skew between phone and server can make this slightly negative.
        if (elapsed.isNegative) return "just now"

        val minutes = elapsed.toMinutes()
        return when {
            minutes < 1 -> "just now"
            minutes < 60 -> "${minutes}m ago"
            minutes < 1440 -> "${elapsed.toHours()}h ago"
            minutes < 10080 -> "${elapsed.toDays()}d ago"
            else -> SHORT.format(instant.atZone(ZoneId.systemDefault()))
        }
    }

    fun parse(iso: String?): Instant? {
        if (iso.isNullOrBlank()) return null
        return runCatching { Instant.parse(iso) }.getOrNull()
    }
}
