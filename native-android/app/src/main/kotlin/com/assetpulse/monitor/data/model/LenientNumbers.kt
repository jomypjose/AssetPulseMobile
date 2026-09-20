package com.assetpulse.monitor.data.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * The AssetPulse API is loose about numeric types: the same column can arrive
 * as a JSON number on one endpoint and a quoted string on another (and
 * `snmp_uptime` arrives preformatted, as `"53d 9h 12m 44s"`).
 *
 * A strict `Double`/`Long` field therefore throws `JsonDecodingException` and
 * takes down the whole response. These serializers accept a number, a numeric
 * string, or anything unparseable — yielding null in the last case, so one odd
 * column can never cost us the rest of the payload.
 */
object LenientDoubleSerializer : KSerializer<Double?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("LenientDouble", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): Double? {
        val input = decoder as? JsonDecoder ?: return null
        val element = input.decodeJsonElement()
        if (element is JsonNull) return null
        val primitive = element as? JsonPrimitive ?: return null
        return primitive.doubleOrNull ?: primitive.content.trim().toDoubleOrNull()
    }

    override fun serialize(encoder: Encoder, value: Double?) {
        if (value == null) encoder.encodeNull() else encoder.encodeDouble(value)
    }
}

object LenientLongSerializer : KSerializer<Long?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("LenientLong", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): Long? {
        val input = decoder as? JsonDecoder ?: return null
        val element = input.decodeJsonElement()
        if (element is JsonNull) return null
        val primitive = element as? JsonPrimitive ?: return null
        return primitive.longOrNull
            ?: primitive.content.trim().toLongOrNull()
            ?: primitive.content.trim().toDoubleOrNull()?.toLong()
    }

    override fun serialize(encoder: Encoder, value: Long?) {
        if (value == null) encoder.encodeNull() else encoder.encodeLong(value)
    }
}
