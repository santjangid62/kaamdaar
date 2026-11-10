package com.kaamdaar.kaamdaar_provider

import android.media.AudioAttributes
import android.media.MediaPlayer
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Hosts the incoming-job siren: a looping MediaPlayer on the alarm stream, so
 * the alert is loud and keeps ringing until the Pro accepts or rejects.
 */
class MainActivity : FlutterActivity() {
    private var alarm: MediaPlayer? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "kaamdaar/alerts")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "startAlarm" -> {
                        startAlarm()
                        result.success(null)
                    }
                    "stopAlarm" -> {
                        stopAlarm()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun startAlarm() {
        if (alarm?.isPlaying == true) return
        stopAlarm()
        alarm = MediaPlayer.create(this, R.raw.job_alert)?.apply {
            isLooping = true
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            setVolume(1f, 1f)
            start()
        }
    }

    private fun stopAlarm() {
        alarm?.let {
            if (it.isPlaying) it.stop()
            it.release()
        }
        alarm = null
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }
}
