package com.shinpstudio.spotlockcamera.ui.camera

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.shinpstudio.spotlockcamera.core.crypto.KeystoreKeyProvider
import com.shinpstudio.spotlockcamera.core.crypto.SpotLockImageSigner
import com.shinpstudio.spotlockcamera.core.image.TimestampOverlayProcessor
import com.shinpstudio.spotlockcamera.core.storage.MediaStoreImageStorage
import com.shinpstudio.spotlockcamera.domain.usecase.CaptureAndSignUseCase
import com.shinpstudio.spotlockcamera.infrastructure.reporter.LogErrorReporter

class CameraViewModelFactory(
    private val context: Context
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(CameraViewModel::class.java)) {
            val keyProvider = KeystoreKeyProvider()
            val signer = SpotLockImageSigner(keyProvider)
            val processor = TimestampOverlayProcessor()
            val storage = MediaStoreImageStorage(context.applicationContext)
            val useCase = CaptureAndSignUseCase(processor, signer, storage)
            val errorReporter = LogErrorReporter()

            return CameraViewModel(useCase, errorReporter) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
