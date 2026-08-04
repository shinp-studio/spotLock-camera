package com.shinpstudio.spotlockcamera.domain.usecase

import com.shinpstudio.spotlockcamera.core.crypto.ImageSigner
import com.shinpstudio.spotlockcamera.core.image.ImageProcessor
import com.shinpstudio.spotlockcamera.core.storage.ImageStorage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureAndSignUseCaseTest {

    @Test
    fun execute_successFlow() {
        val fakeProcessor = object : ImageProcessor {
            override fun process(rawBytes: ByteArray, timestampMs: Long, rotationDegrees: Int): ByteArray = rawBytes
        }
        val fakeSigner = object : ImageSigner {
            override fun signAndEmbed(jpegBytes: ByteArray, timestampMs: Long): ByteArray = jpegBytes
        }
        val fakeStorage = object : ImageStorage {
            override fun saveImage(signedJpegBytes: ByteArray, timestampMs: Long): Result<String> = Result.success("SpotLock_123.jpg")
        }

        val useCase = CaptureAndSignUseCase(fakeProcessor, fakeSigner, fakeStorage)
        val result = useCase.execute(byteArrayOf(1, 2, 3), System.currentTimeMillis(), 0)

        assertTrue(result.isSuccess)
        assertEquals("SpotLock_123.jpg", result.getOrNull())
    }

    @Test
    fun execute_failsWhenProcessorFails() {
        val fakeProcessor = object : ImageProcessor {
            override fun process(rawBytes: ByteArray, timestampMs: Long, rotationDegrees: Int): ByteArray {
                throw RuntimeException("Processor error")
            }
        }
        val fakeSigner = object : ImageSigner {
            override fun signAndEmbed(jpegBytes: ByteArray, timestampMs: Long): ByteArray = jpegBytes
        }
        val fakeStorage = object : ImageStorage {
            override fun saveImage(signedJpegBytes: ByteArray, timestampMs: Long): Result<String> = Result.success("SpotLock_123.jpg")
        }

        val useCase = CaptureAndSignUseCase(fakeProcessor, fakeSigner, fakeStorage)
        val result = useCase.execute(byteArrayOf(1, 2, 3), System.currentTimeMillis(), 0)

        assertTrue(result.isFailure)
        assertEquals("Processor error", result.exceptionOrNull()?.message)
    }

    @Test
    fun execute_failsWhenSignerFails() {
        val fakeProcessor = object : ImageProcessor {
            override fun process(rawBytes: ByteArray, timestampMs: Long, rotationDegrees: Int): ByteArray = rawBytes
        }
        val fakeSigner = object : ImageSigner {
            override fun signAndEmbed(jpegBytes: ByteArray, timestampMs: Long): ByteArray {
                throw RuntimeException("Signing error")
            }
        }
        val fakeStorage = object : ImageStorage {
            override fun saveImage(signedJpegBytes: ByteArray, timestampMs: Long): Result<String> = Result.success("SpotLock_123.jpg")
        }

        val useCase = CaptureAndSignUseCase(fakeProcessor, fakeSigner, fakeStorage)
        val result = useCase.execute(byteArrayOf(1, 2, 3), System.currentTimeMillis(), 0)

        assertTrue(result.isFailure)
        assertEquals("Signing error", result.exceptionOrNull()?.message)
    }

    @Test
    fun execute_failsWhenStorageFails() {
        val fakeProcessor = object : ImageProcessor {
            override fun process(rawBytes: ByteArray, timestampMs: Long, rotationDegrees: Int): ByteArray = rawBytes
        }
        val fakeSigner = object : ImageSigner {
            override fun signAndEmbed(jpegBytes: ByteArray, timestampMs: Long): ByteArray = jpegBytes
        }
        val fakeStorage = object : ImageStorage {
            override fun saveImage(signedJpegBytes: ByteArray, timestampMs: Long): Result<String> {
                return Result.failure(RuntimeException("Storage error"))
            }
        }

        val useCase = CaptureAndSignUseCase(fakeProcessor, fakeSigner, fakeStorage)
        val result = useCase.execute(byteArrayOf(1, 2, 3), System.currentTimeMillis(), 0)

        assertTrue(result.isFailure)
        assertEquals("Storage error", result.exceptionOrNull()?.message)
    }
}
