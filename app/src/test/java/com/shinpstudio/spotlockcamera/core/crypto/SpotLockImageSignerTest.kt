package com.shinpstudio.spotlockcamera.core.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.PublicKey
import java.security.spec.ECGenParameterSpec

class SpotLockImageSignerTest {

    private lateinit var privateKey: PrivateKey
    private lateinit var publicKey: PublicKey

    @Before
    fun setUp() {
        val keyPairGenerator = KeyPairGenerator.getInstance("EC")
        keyPairGenerator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = keyPairGenerator.generateKeyPair()
        privateKey = keyPair.private
        publicKey = keyPair.public
    }

    @Test
    fun signAndEmbed_successfullyEmbedsAPP15Segment() {
        val fakeKeyProvider = object : PrivateKeyProvider {
            override fun getPrivateKey(): PrivateKey = privateKey
            override fun getPublicKey(): PublicKey = publicKey
        }
        val signer = SpotLockImageSigner(fakeKeyProvider)

        val minimalJpeg = byteArrayOf(
            0xFF.toByte(), 0xD8.toByte(),
            0xFF.toByte(), 0xD9.toByte()
        )
        val timestamp = System.currentTimeMillis()

        val signedJpeg = signer.signAndEmbed(minimalJpeg, timestamp)

        assertTrue(signedJpeg.size > minimalJpeg.size)
        assertEquals(0xFF.toByte(), signedJpeg[0])
        assertEquals(0xD8.toByte(), signedJpeg[1])
        assertEquals(0xFF.toByte(), signedJpeg[2])
        assertEquals(0xEF.toByte(), signedJpeg[3])
    }

    @Test(expected = IllegalStateException::class)
    fun signAndEmbed_failsWhenPrivateKeyIsNull() {
        val fakeKeyProvider = object : PrivateKeyProvider {
            override fun getPrivateKey(): PrivateKey? = null
            override fun getPublicKey(): PublicKey = publicKey
        }
        val signer = SpotLockImageSigner(fakeKeyProvider)
        val minimalJpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xD9.toByte())

        signer.signAndEmbed(minimalJpeg, System.currentTimeMillis())
    }

    @Test(expected = RuntimeException::class)
    fun signAndEmbed_rethrowsExceptionWhenPrivateKeyProviderThrows() {
        val fakeKeyProvider = object : PrivateKeyProvider {
            override fun getPrivateKey(): PrivateKey {
                throw RuntimeException("KeyStore error")
            }
            override fun getPublicKey(): PublicKey = publicKey
        }
        val signer = SpotLockImageSigner(fakeKeyProvider)
        val minimalJpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xD9.toByte())

        signer.signAndEmbed(minimalJpeg, System.currentTimeMillis())
    }
}
