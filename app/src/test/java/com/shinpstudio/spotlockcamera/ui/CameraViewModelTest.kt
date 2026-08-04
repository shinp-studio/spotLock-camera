package com.shinpstudio.spotlockcamera.ui

import androidx.camera.core.ImageInfo
import androidx.camera.core.ImageProxy
import com.shinpstudio.spotlockcamera.domain.reporter.ErrorReporter
import com.shinpstudio.spotlockcamera.domain.usecase.CaptureAndSignUseCase
import com.shinpstudio.spotlockcamera.ui.camera.CameraViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.nio.ByteBuffer

@OptIn(ExperimentalCoroutinesApi::class)
class CameraViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeErrorReporter: FakeErrorReporter

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeErrorReporter = FakeErrorReporter()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun captureAndSign_successFlow() = runTest {
        val mockUseCase = object : CaptureAndSignUseCase(
            processor = FakeProcessor(),
            signer = FakeSigner(),
            storage = FakeStorage()
        ) {
            override fun execute(
                rawImageBytes: ByteArray,
                timestampMs: Long,
                rotationDegrees: Int
            ): Result<String> {
                return Result.success("saved_photo.jpg")
            }
        }

        val viewModel = CameraViewModel(mockUseCase, fakeErrorReporter, testDispatcher)
        val mockImageProxy = createMockImageProxy()

        viewModel.captureAndSign(mockImageProxy)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isCapturing)
        assertEquals("Saved & Signed: saved_photo.jpg", state.toastMessage)
        assertNull(state.errorMessage)
    }

    @Test
    fun captureAndSign_failureFlow() = runTest {
        val mockUseCase = object : CaptureAndSignUseCase(
            processor = FakeProcessor(),
            signer = FakeSigner(),
            storage = FakeStorage()
        ) {
            override fun execute(
                rawImageBytes: ByteArray,
                timestampMs: Long,
                rotationDegrees: Int
            ): Result<String> {
                return Result.failure(RuntimeException("Storage full"))
            }
        }

        val viewModel = CameraViewModel(mockUseCase, fakeErrorReporter, testDispatcher)
        val mockImageProxy = createMockImageProxy()

        viewModel.captureAndSign(mockImageProxy)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isCapturing)
        assertEquals("Error: Storage full", state.errorMessage)
        assertNull(state.toastMessage)
        assertEquals(1, fakeErrorReporter.reportedErrors.size)
    }

    private fun createMockImageProxy(): ImageProxy {
        val plane = object : ImageProxy.PlaneProxy {
            override fun getBuffer(): ByteBuffer = ByteBuffer.wrap(byteArrayOf(1, 2, 3))
            override fun getRowStride(): Int = 3
            override fun getPixelStride(): Int = 1
        }
        val imageInfo = object : ImageInfo {
            override fun getRotationDegrees(): Int = 0
            override fun getSensorToBufferTransformMatrix(): android.graphics.Matrix = android.graphics.Matrix()
            override fun getTimestamp(): Long = 0L
            override fun populateExifData(builder: androidx.camera.core.impl.utils.ExifData.Builder) {}
        }
        return object : ImageProxy {
            override fun close() {}
            override fun getCropRect(): android.graphics.Rect = android.graphics.Rect()
            override fun setCropRect(rect: android.graphics.Rect?) {}
            override fun getFormat(): Int = 0
            override fun getHeight(): Int = 100
            override fun getWidth(): Int = 100
            override fun getPlanes(): Array<ImageProxy.PlaneProxy> = arrayOf(plane)
            override fun getImageInfo(): ImageInfo = imageInfo
            override fun getImage(): android.media.Image? = null
        }
    }
}

private class FakeErrorReporter : ErrorReporter {
    val reportedErrors = mutableListOf<Pair<Throwable, String?>>()
    override fun report(throwable: Throwable, message: String?) {
        reportedErrors.add(throwable to message)
    }
}

private class FakeProcessor : com.shinpstudio.spotlockcamera.core.image.ImageProcessor {
    override fun process(rawBytes: ByteArray, timestampMs: Long, rotationDegrees: Int): ByteArray = rawBytes
}

private class FakeSigner : com.shinpstudio.spotlockcamera.core.crypto.ImageSigner {
    override fun signAndEmbed(jpegBytes: ByteArray, timestampMs: Long): ByteArray = jpegBytes
}

private class FakeStorage : com.shinpstudio.spotlockcamera.core.storage.ImageStorage {
    override fun saveImage(signedJpegBytes: ByteArray, timestampMs: Long): Result<String> = Result.success("test.jpg")
}
