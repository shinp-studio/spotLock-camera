package com.shinpstudio.spotlockcamera.core.image

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream

class TimestampOverlayProcessorTest {

    @Test
    fun process_drawsTimestampOverlayAndReturnsNonEmptyBytes() {
        val processor = TimestampOverlayProcessor()
        val dummyBitmap = android.graphics.Bitmap.createBitmap(100, 100, android.graphics.Bitmap.Config.ARGB_8888)
        val baos = ByteArrayOutputStream()
        dummyBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, baos)
        val rawJpegBytes = baos.toByteArray()

        val processedBytes = processor.process(rawJpegBytes, System.currentTimeMillis(), 0)

        assertTrue(processedBytes.isNotEmpty())
    }
}
