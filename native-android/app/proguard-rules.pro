# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.assetpulse.monitor.** {
    *** Companion;
}
-keepclasseswithmembers class com.assetpulse.monitor.** {
    kotlinx.serialization.KSerializer serializer(...);
}
