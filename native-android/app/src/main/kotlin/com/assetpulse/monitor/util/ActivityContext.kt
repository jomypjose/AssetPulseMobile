package com.assetpulse.monitor.util

import android.content.Context
import android.content.ContextWrapper
import androidx.fragment.app.FragmentActivity

/**
 * Walks the ContextWrapper chain to the hosting Activity.
 *
 * `LocalActivity` would do this for us, but it only landed in
 * activity-compose 1.10; this keeps us off that version bump for now.
 */
tailrec fun Context.findFragmentActivity(): FragmentActivity? = when (this) {
    is FragmentActivity -> this
    is ContextWrapper -> baseContext.findFragmentActivity()
    else -> null
}
