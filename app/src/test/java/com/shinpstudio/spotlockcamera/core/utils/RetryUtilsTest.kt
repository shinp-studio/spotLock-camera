package com.shinpstudio.spotlockcamera.core.utils

import org.junit.Assert.assertEquals
import org.junit.Test

class RetryUtilsTest {

    @Test
    fun executeWithRetry_succeedsFirstAttempt() {
        var attempts = 0
        val result = RetryUtils.executeWithRetry(maxRetries = 3) {
            attempts++
            "Success"
        }
        assertEquals("Success", result)
        assertEquals(1, attempts)
    }

    @Test
    fun executeWithRetry_succeedsAfterRetries() {
        var attempts = 0
        val result = RetryUtils.executeWithRetry(maxRetries = 3) {
            attempts++
            if (attempts < 3) {
                throw RuntimeException("Temporary failure")
            }
            "SuccessAfterRetries"
        }
        assertEquals("SuccessAfterRetries", result)
        assertEquals(3, attempts)
    }

    @Test(expected = RuntimeException::class)
    fun executeWithRetry_throwsAfterMaxRetries() {
        var attempts = 0
        RetryUtils.executeWithRetry(maxRetries = 3) {
            attempts++
            throw RuntimeException("Persistent failure")
        }
    }
}
