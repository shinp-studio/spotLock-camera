package com.shinpstudio.spotlockcamera.domain.reporter

class FakeErrorReporter : ErrorReporter {
    val reportedErrors = mutableListOf<Pair<Throwable, String?>>()

    override fun report(throwable: Throwable, message: String?) {
        reportedErrors.add(throwable to message)
    }
}
