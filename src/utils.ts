const SUFFIX_DIRECT_MESSAGE = "@c.us"

/**
 * Add WhatsApp suffix (@c.us) to the phone number if it doesn't have it yet
 * @param phone
 */
export function ensureSuffix(phone) {
    if (phone.includes("@")) {
        return phone
    }
    return phone + SUFFIX_DIRECT_MESSAGE
}
