pluginManagement {
 val flutterSdkPath=run { val p=java.util.Properties();file("local.properties").inputStream().use{p.load(it)};val v=p.getProperty("flutter.sdk");require(v!=null){"flutter.sdk not set"};v }
 includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")
 repositories{google();mavenCentral();gradlePluginPortal()}
}
plugins{
 id("dev.flutter.flutter-plugin-loader") version "1.0.0"
 id("com.android.application") version "9.1.1" apply false
 id("org.jetbrains.kotlin.android") version "2.4.0" apply false
}
include(":app")