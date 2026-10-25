"use client"

import React, { useEffect, useMemo, useRef } from "react"
import { AttachFileOutlined, CloseOutlined, SendRounded } from "@mui/icons-material"
import {
  alpha,
  Box,
  IconButton,
  InputBase,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { Formik, type FormikHelpers } from "formik"
import { useRouter } from "next/navigation"
import type { ObjectSchema } from "yup"
import * as yup from "yup"

import EmojiPickerButton, { insertEmojiAtCursor } from "@/components/EmojiPickerButton"
import FlexBetween from "@/components/FlexBetween"
import { unstyledButtonSx } from "@/components/sharedSx"
import UserImage from "@/components/UserImage"
import WidgetWrapper from "@/components/WidgetWrapper"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { ACCEPT_IMAGE, validateImageFile } from "@/lib/imageUpload"
import {
  graphemeLength,
  POST_DESCRIPTION_LIMIT_REACHED,
  POST_DESCRIPTION_MAX,
  POST_DESCRIPTION_MAX_LABEL,
  truncateGraphemes,
} from "@/lib/postLimits"
import { useFeatureFlags } from "@/providers/FeatureFlagsProvider"
import { useToast } from "@/providers/ToastProvider"
import { prependPost } from "@/state"
import type { CreatePostFormValues, Post } from "@/types/models"

import { useAppDispatch, useAppSelector } from "../hooks"

type MyPostWidgetProps = { url: string }

type ImagePreviewProps = {
  file: File
  disabled?: boolean
  onRemove: () => void
  onReplace: () => void
}

const ImagePreview = ({ file, disabled, onRemove, onReplace }: ImagePreviewProps) => {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file])

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        bgcolor: "background.default",
        borderRadius: 2,
        overflow: "hidden",
        border: theme => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        component="img"
        src={previewUrl}
        alt={file.name}
        sx={{
          display: "block",
          width: "100%",
          maxHeight: 320,
          objectFit: "contain",
          bgcolor: "background.default",
        }}
      />
      <IconButton
        onClick={e => {
          e.stopPropagation()
          onRemove()
        }}
        disabled={disabled}
        aria-label="Remove photo"
        size="small"
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: theme => alpha(theme.palette.common.black, 0.72),
          color: "common.white",
          "&:hover": { bgcolor: theme => alpha(theme.palette.common.black, 0.88) },
        }}
      >
        <CloseOutlined fontSize="small" />
      </IconButton>
      <Box
        component="button"
        type="button"
        onClick={onReplace}
        disabled={disabled}
        sx={{
          display: "block",
          width: "100%",
          border: 0,
          textAlign: "left",
          cursor: disabled ? "default" : "pointer",
          px: 1.5,
          py: 0.75,
          font: "inherit",
          fontSize: "0.75rem",
          color: "text.secondary",
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.alt",
          "&:hover": disabled ? undefined : { color: "primary.main" },
        }}
      >
        <Typography component="span" noWrap title={file.name} sx={{ fontSize: "inherit" }}>
          {file.name} · click to replace
        </Typography>
      </Box>
    </Box>
  )
}

const POST_EMPTY_MESSAGE = "Add some text or a photo before posting."

const createPostSchema: ObjectSchema<CreatePostFormValues> = yup.object({
  description: yup
    .string()
    .default("")
    .test(
      "max-graphemes",
      `Keep posts under ${POST_DESCRIPTION_MAX_LABEL}`,
      value => graphemeLength(value ?? "") <= POST_DESCRIPTION_MAX
    )
    .test("has-content", POST_EMPTY_MESSAGE, function (value) {
      const picture = (this.parent as CreatePostFormValues).picture
      return Boolean(value?.trim()) || picture instanceof File
    }),
  picture: yup.mixed<File>().nullable().default(null),
})

const createPostInitVals: CreatePostFormValues = {
  description: "",
  picture: null,
}

const MyPostWidget = ({ url }: MyPostWidgetProps) => {
  const user = useAppSelector(state => state.user)
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { palette } = useTheme()
  const medMain = palette.neutral.mediumMain

  const descriptionInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { success, error: toastError } = useToast()
  const { enabled } = useFeatureFlags()
  const canImages = enabled("postsImages")
  const canEmoji = enabled("postsEmoji")

  const handleCreatePost = async (vals: CreatePostFormValues, helpers: FormikHelpers<CreatePostFormValues>) => {
    if (!user?._id) {
      helpers.setStatus("You must be logged in to post")
      return
    }

    try {
      helpers.setStatus(undefined)
      const formData = new FormData()
      formData.append("description", vals.description.trim())
      if (vals.picture instanceof File) {
        formData.append("picture", vals.picture)
      }

      const { data } = await api.post<{ post: Post }>("/posts", formData)
      dispatch(prependPost({ post: data.post }))
      helpers.resetForm()
      if (fileInputRef.current) fileInputRef.current.value = ""
      success("Post created")
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Failed to create post")
      helpers.setStatus(msg)
      toastError(msg)
    }
  }

  return (
    <WidgetWrapper
      data-tour="compose"
      sx={{ p: { xs: "1.15rem", sm: "1.35rem 1.25rem 1.15rem" } }}
    >
      <Formik<CreatePostFormValues>
        initialValues={createPostInitVals}
        validationSchema={createPostSchema}
        onSubmit={handleCreatePost}
        validateOnBlur
        validateOnChange={false}
      >
        {({
          values,
          errors,
          touched,
          handleSubmit,
          setFieldValue,
          setFieldTouched,
          status,
          submitCount,
          isSubmitting,
        }) => {
          const showContentError =
            submitCount > 0 && Boolean(errors.description || errors.picture)
          const contentErrorMessage = errors.description
            ? String(errors.description)
            : errors.picture
              ? String(errors.picture)
              : POST_EMPTY_MESSAGE
          const canSubmit =
            Boolean(values.description?.trim()) || values.picture instanceof File
          const hasPhoto = values.picture instanceof File
          const charCount = graphemeLength(values.description ?? "")
          const atCharLimit = charCount >= POST_DESCRIPTION_MAX

          const openFilePicker = () => {
            if (isSubmitting) return
            fileInputRef.current?.click()
          }

          const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            const invalid = validateImageFile(file)
            if (invalid) {
              toastError(invalid)
              return
            }
            void setFieldValue("picture", file)
          }

          return (
            <form onSubmit={handleSubmit} noValidate>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_IMAGE}
                hidden
                onChange={onFileChange}
              />

              <FlexBetween sx={{ gap: "0.75rem", alignItems: "flex-start" }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => router.push("/profile")}
                  aria-label="Open your profile"
                  sx={{
                    ...unstyledButtonSx,
                    mt: 0.55,
                    flexShrink: 0,
                    borderRadius: "50%",
                    lineHeight: 0,
                  }}
                >
                  <UserImage
                    image={url}
                    name={[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
                    size="44px"
                    bgColor={user?.avatarColor}
                  />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 0.5,
                      borderRadius: "12px",
                      pl: 1.5,
                      pr: 0.65,
                      py: 0.45,
                      minHeight: 48,
                      backgroundColor: palette.neutral.light,
                      border: showContentError
                        ? `1px solid ${palette.error.main}`
                        : `1px solid ${palette.divider}`,
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                      "&:focus-within": {
                        borderColor: palette.primary.main,
                        boxShadow: `0 0 0 3px ${alpha(palette.primary.main, 0.16)}`,
                      },
                    }}
                  >
                    <InputBase
                      name="description"
                      placeholder="What's on your mind?"
                      inputRef={descriptionInputRef}
                      multiline
                      maxRows={5}
                      aria-invalid={showContentError || atCharLimit}
                      aria-describedby={
                        showContentError || atCharLimit ? "create-post-error" : "create-post-char-count"
                      }
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        py: 0.85,
                        fontSize: "0.95rem",
                        alignSelf: "center",
                        lineHeight: 1.4,
                      }}
                      value={values.description ?? ""}
                      onBlur={() => void setFieldTouched("description", true)}
                      onChange={e =>
                        void setFieldValue(
                          "description",
                          truncateGraphemes(e.target.value, POST_DESCRIPTION_MAX)
                        )
                      }
                      disabled={isSubmitting}
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          if (!isSubmitting && canSubmit) {
                            const form = e.currentTarget.closest("form")
                            if (form && typeof form.requestSubmit === "function") form.requestSubmit()
                          }
                        }
                      }}
                    />
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.25,
                        flexShrink: 0,
                        alignSelf: "center",
                        pl: 0.75,
                        ml: 0.25,
                        borderLeft: `1px solid ${palette.divider}`,
                        minHeight: 32,
                      }}
                    >
                      {canImages ? (
                        <Tooltip title={hasPhoto ? "Replace photo" : "Add photo"}>
                          <IconButton
                            type="button"
                            size="small"
                            disabled={isSubmitting}
                            aria-label={hasPhoto ? "Replace photo" : "Add photo"}
                            aria-pressed={hasPhoto}
                            onClick={openFilePicker}
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: "8px",
                              color: hasPhoto ? palette.primary.main : medMain,
                              bgcolor: hasPhoto ? alpha(palette.primary.main, 0.1) : "transparent",
                              "&:hover": {
                                color: palette.primary.main,
                                bgcolor: alpha(palette.primary.main, 0.08),
                              },
                            }}
                          >
                            <AttachFileOutlined sx={{ fontSize: "1.15rem" }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {canEmoji ? (
                        <EmojiPickerButton
                          dense
                          disabled={isSubmitting}
                          onSelect={emoji =>
                            insertEmojiAtCursor(
                              descriptionInputRef.current,
                              values.description,
                              emoji,
                              next =>
                                void setFieldValue(
                                  "description",
                                  truncateGraphemes(next, POST_DESCRIPTION_MAX)
                                )
                            )
                          }
                        />
                      ) : null}
                      <Tooltip title={canSubmit ? "Post" : "Add text or a photo to post"}>
                        <span>
                          <IconButton
                            type="submit"
                            size="small"
                            disabled={isSubmitting || !canSubmit}
                            aria-label="Post"
                            sx={{
                              ml: 0.15,
                              width: 32,
                              height: 32,
                              borderRadius: "8px",
                              color: palette.common.white,
                              bgcolor: palette.primary.main,
                              transition: "background-color 0.15s ease, transform 0.12s ease",
                              "&:hover": { bgcolor: palette.primary.dark },
                              "&:active": { transform: "scale(0.94)" },
                              "&.Mui-disabled": {
                                bgcolor: alpha(palette.primary.main, 0.28),
                                color: alpha(palette.common.white, 0.8),
                              },
                            }}
                          >
                            <SendRounded sx={{ fontSize: "1.05rem" }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 1,
                      mt: showContentError || atCharLimit || charCount > 0 ? "0.55rem" : 0,
                    }}
                  >
                    {showContentError ? (
                      <Typography
                        id="create-post-error"
                        role="alert"
                        sx={{
                          color: "error.main",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {contentErrorMessage}
                      </Typography>
                    ) : atCharLimit ? (
                      <Typography
                        id="create-post-error"
                        role="status"
                        sx={{
                          color: "error.main",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {POST_DESCRIPTION_LIMIT_REACHED}
                      </Typography>
                    ) : (
                      <span />
                    )}
                    {charCount > 0 ? (
                      <Typography
                        id="create-post-char-count"
                        component="span"
                        aria-live="polite"
                        sx={{
                          flexShrink: 0,
                          ml: "auto",
                          fontSize: "0.75rem",
                          fontWeight: atCharLimit ? 600 : 400,
                          color: atCharLimit ? "error.main" : medMain,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {charCount.toLocaleString()} / {POST_DESCRIPTION_MAX.toLocaleString()}
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              </FlexBetween>

              {hasPhoto && values.picture ? (
                <Box sx={{ mt: "0.85rem", ml: { xs: 0, sm: "3.45rem" } }}>
                  <ImagePreview
                    file={values.picture}
                    disabled={isSubmitting}
                    onRemove={() => {
                      void setFieldValue("picture", null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    onReplace={openFilePicker}
                  />
                  {(touched.picture || submitCount > 0) && errors.picture && (
                    <Typography sx={{ color: "error.main", mt: "0.5rem", fontSize: "0.75rem" }} role="alert">
                      {String(errors.picture)}
                    </Typography>
                  )}
                </Box>
              ) : null}

              {status && (
                <Typography sx={{ color: "error.main", mt: "0.85rem", textAlign: "center" }} role="alert">
                  {String(status)}
                </Typography>
              )}
            </form>
          )
        }}
      </Formik>
    </WidgetWrapper>
  )
}

export default MyPostWidget
