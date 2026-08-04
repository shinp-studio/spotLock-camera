package com.shinpstudio.spotlockcamera.infrastructure.reporter

import android.util.Log
import com.shinpstudio.spotlockcamera.domain.reporter.ErrorReporter

class LogErrorReporter : ErrorReporter {
    override fun report(throwable: Throwable, message: String?) {
        Log.e("SpotLockCamera", message ?: throwable.message ?: "Unknown error occurred", throwable)
    }
}
