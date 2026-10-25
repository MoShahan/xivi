"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@mui/material"
import { Formik } from "formik"
import * as yup from "yup"

import { useAppDispatch } from "@/app/hooks"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { ACCEPT_IMAGE, MAX_IMAGE_LABEL, validateImageFile } from "@/lib/imageUpload"
import {
  DEFAULT_AVATAR_COLOR,
  DEFAULT_COVER_COLOR,
  normalizeProfileColor,
} from "@/lib/profileColors"
import { SOCIAL_NETWORKS } from "@/lib/social"
import { useToast } from "@/providers/ToastProvider"
import { setUser } from "@/state"
import type { User } from "@/types/models"

import ColorSwatchPicker from "./ColorSwatchPicker"
import UserImage from "./UserImage"

type EditProfileDialogProps = {
  open: boolean
  onClose: () => void
  user: User
  onSaved?: (user: User) => void
}

type EditProfileValues = {
  firstName: string
  lastName: string
  location: string
  occupation: string
  facebook: string
  x: string
  linkedin: string
  instagram: string
  avatarColor: string
  coverColor: string
  picture: File | null
}

const schema = yup.object({
  firstName: yup
    .string()
    .trim()
    .required("First name is required")
    .min(1, "First name is required")
    .max(50, "First name must be at most 50 characters"),
  lastName: yup
    .string()
    .trim()
    .required("Last name is required")
    .min(1, "Last name is required")
    .max(50, "Last name must be at most 50 characters"),
  location: yup.string().trim().max(100),
  occupation: yup.string().trim().max(100),
  facebook: yup.string().trim().max(64),
  x: yup.string().trim().max(64),
  linkedin: yup.string().trim().max(64),
  instagram: yup.string().trim().max(64),
  avatarColor: yup.string().required(),
  coverColor: yup.string().required(),
})

function valuesFromUser(user: User): EditProfileValues {
  return {
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    location: user.location || "",
    occupation: user.occupation || "",
    facebook: user.facebook || "",
    x: user.x || "",
    linkedin: user.linkedin || "",
    instagram: user.instagram || "",
    avatarColor: normalizeProfileColor(user.avatarColor, DEFAULT_AVATAR_COLOR),
    coverColor: normalizeProfileColor(user.coverColor, DEFAULT_COVER_COLOR),
    picture: null,
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        fontSize: "0.7rem",
        color: "text.secondary",
        mb: 1.25,
      }}
    >
      {children}
    </Typography>
  )
}

const EditProfileForm = ({
  user,
  onClose,
  onSaved,
}: Omit<EditProfileDialogProps, "open">) => {
  const dispatch = useAppDispatch()
  const { success, error: toastError } = useToast()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
      <Formik<EditProfileValues>
        initialValues={valuesFromUser(user)}
        validationSchema={schema}
        onSubmit={async (vals, helpers) => {
          try {
            helpers.setStatus(undefined)
            const formData = new FormData()
            formData.append("firstName", vals.firstName.trim())
            formData.append("lastName", vals.lastName.trim())
            formData.append("location", vals.location.trim())
            formData.append("occupation", vals.occupation.trim())
            formData.append("facebook", vals.facebook.trim())
            formData.append("x", vals.x.trim())
            formData.append("linkedin", vals.linkedin.trim())
            formData.append("instagram", vals.instagram.trim())
            formData.append("avatarColor", vals.avatarColor)
            formData.append("coverColor", vals.coverColor)
            if (vals.picture instanceof File) {
              formData.append("picture", vals.picture)
            }

            const { data } = await api.patch<{ user: User }>("/users/me", formData)
            dispatch(setUser({ user: data.user }))
            onSaved?.(data.user)
            success("Profile updated")
            onClose()
          } catch (e: unknown) {
            const msg = getErrorMessage(e, "Could not update profile")
            helpers.setStatus(msg)
            toastError(msg)
          }
        }}
      >
        {({
          values,
          errors,
          touched,
          handleBlur,
          handleChange,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          status,
        }) => (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
          >
            <DialogTitle id="edit-profile-title" sx={{ pb: 1.25 }}>
              Edit profile
            </DialogTitle>
            <DialogContent
              dividers
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                px: { xs: 2, sm: 3 },
                py: 0,
                flex: 1,
                minHeight: 0,
              }}
            >
              <Box sx={{ py: 2.25 }}>
                <SectionLabel>Photo and colors</SectionLabel>
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    border: theme => `1px solid ${theme.palette.divider}`,
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{ height: 36, bgcolor: values.coverColor }}
                    aria-label="Cover color preview"
                  />
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 1.5,
                      py: 1.25,
                    }}
                  >
                    <Box
                      sx={{
                        borderRadius: "50%",
                        border: theme => `2px solid ${theme.palette.divider}`,
                        flexShrink: 0,
                        lineHeight: 0,
                      }}
                    >
                      <UserImage
                        key={previewUrl || user.picturePath || "avatar"}
                        image={previewUrl || user.picturePath || ""}
                        name={`${values.firstName} ${values.lastName}`}
                        size="52px"
                        bgColor={values.avatarColor}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept={ACCEPT_IMAGE}
                        hidden
                        onChange={e => {
                          const file = e.target.files?.[0] ?? null
                          e.target.value = ""
                          if (!file) {
                            setFieldValue("picture", null)
                            if (previewUrl) URL.revokeObjectURL(previewUrl)
                            setPreviewUrl(null)
                            return
                          }
                          const invalid = validateImageFile(file)
                          if (invalid) {
                            toastError(invalid)
                            return
                          }
                          setFieldValue("picture", file)
                          if (previewUrl) URL.revokeObjectURL(previewUrl)
                          setPreviewUrl(URL.createObjectURL(file))
                        }}
                      />
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        onClick={() => photoInputRef.current?.click()}
                        sx={{
                          lineHeight: 1.4,
                          py: 0.55,
                          px: 1.25,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        Change photo
                      </Button>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.4, display: "block", lineHeight: 1.35 }}
                      >
                        {`JPEG, PNG, GIF, or WebP · max ${MAX_IMAGE_LABEL}. On a phone, use Camera or Photo Library.`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                  <ColorSwatchPicker
                    label="Avatar color"
                    hint="Shown when you don’t have a profile photo."
                    value={values.avatarColor}
                    onChange={hex => setFieldValue("avatarColor", hex)}
                  />
                  <ColorSwatchPicker
                    label="Cover color"
                    hint="Solid header on your profile."
                    value={values.coverColor}
                    onChange={hex => setFieldValue("coverColor", hex)}
                  />
                </Box>
              </Box>

              <Divider />

              <Box sx={{ py: 2.25 }}>
                <SectionLabel>About</SectionLabel>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.75,
                    }}
                  >
                    <TextField
                      label="First name"
                      name="firstName"
                      value={values.firstName}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      error={Boolean(touched.firstName && errors.firstName)}
                      helperText={touched.firstName && errors.firstName}
                      fullWidth
                    />
                    <TextField
                      label="Last name"
                      name="lastName"
                      value={values.lastName}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      error={Boolean(touched.lastName && errors.lastName)}
                      helperText={touched.lastName && errors.lastName}
                      fullWidth
                    />
                  </Box>
                  <TextField
                    label="Location"
                    name="location"
                    value={values.location}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    fullWidth
                  />
                  <TextField
                    label="Occupation"
                    name="occupation"
                    value={values.occupation}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    fullWidth
                  />
                </Box>
              </Box>

              <Divider />

              <Box sx={{ py: 2.25 }}>
                <SectionLabel>Social</SectionLabel>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Optional usernames or handles (not full URLs).
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                  {SOCIAL_NETWORKS.map(({ key, label }) => (
                    <TextField
                      key={key}
                      label={label}
                      name={key}
                      value={values[key]}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="username"
                      fullWidth
                    />
                  ))}
                </Box>
              </Box>

              {status ? (
                <Typography color="error" role="alert" sx={{ pb: 2 }}>
                  {String(status)}
                </Typography>
              ) : null}
            </DialogContent>
            <DialogActions
              sx={{
                px: { xs: 2, sm: 3 },
                py: 1.5,
                position: "sticky",
                bottom: 0,
                bgcolor: "background.paper",
                borderTop: theme => `1px solid ${theme.palette.divider}`,
                zIndex: 1,
              }}
            >
              <Button onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogActions>
          </form>
        )}
        </Formik>
  )
}

const EditProfileDialog = ({ open, onClose, user, onSaved }: EditProfileDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullWidth
    maxWidth="sm"
    aria-labelledby="edit-profile-title"
    slotProps={{
      paper: {
        sx: {
          display: "flex",
          flexDirection: "column",
          maxHeight: "min(92dvh, 720px)",
        },
      },
    }}
  >
    {open ? <EditProfileForm user={user} onClose={onClose} onSaved={onSaved} /> : null}
  </Dialog>
)

export default EditProfileDialog
