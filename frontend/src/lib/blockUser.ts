import type { ObjectSchema } from "yup"
import * as yup from "yup"

import type { BlockReason } from "@/types/models"

export const CUSTOM_REASON_MAX = 200

export const BLOCK_REASON_OPTIONS: { value: BlockReason; label: string }[] = [
  { value: "harassment", label: "Harassment" },
  { value: "bullying", label: "Bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "offensive", label: "Offensive or inappropriate" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "fake_account", label: "Fake account" },
  { value: "dont_want", label: "I don’t want to see this person" },
  { value: "other", label: "Other" },
]

const BLOCK_REASON_VALUES = new Set<string>(BLOCK_REASON_OPTIONS.map(option => option.value))

export type BlockUserFormValues = {
  reason: BlockReason | ""
  customReason: string
}

export const blockUserSchema: ObjectSchema<BlockUserFormValues> = yup.object({
  reason: yup
    .mixed<BlockReason | "">()
    .defined()
    .test("reason-required", "Choose a reason", value => BLOCK_REASON_VALUES.has(value || "")),
  customReason: yup
    .string()
    .defined()
    .trim()
    .when("reason", {
      is: "other",
      then: schema =>
        schema
          .required("Please describe why you are blocking this person")
          .max(CUSTOM_REASON_MAX, `Must be ${CUSTOM_REASON_MAX} characters or fewer`),
      otherwise: schema => schema.max(CUSTOM_REASON_MAX),
    }),
})

export function blockReasonLabel(reason?: string, customReason?: string): string {
  if (reason === "other") {
    const custom = (customReason || "").trim()
    return custom || "Other"
  }
  return BLOCK_REASON_OPTIONS.find(option => option.value === reason)?.label || "Blocked"
}
