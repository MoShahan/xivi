"use client"

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { Formik } from "formik"

import { useAppDispatch } from "@/app/hooks"
import { api } from "@/lib/api"
import { BLOCK_REASON_OPTIONS, type BlockUserFormValues, blockUserSchema, CUSTOM_REASON_MAX } from "@/lib/blockUser"
import { getErrorMessage } from "@/lib/errors"
import { useToast } from "@/providers/ToastProvider"
import { removePostsByUser } from "@/state"

type BlockUserDialogProps = {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  onBlocked?: () => void
}

const initialValues: BlockUserFormValues = { reason: "", customReason: "" }

const BlockUserDialog = ({ open, onClose, userId, userName, onBlocked }: BlockUserDialogProps) => {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"))
  const dispatch = useAppDispatch()
  const { success, error: toastError } = useToast()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="xs"
      aria-labelledby="block-user-dialog-title"
    >
      <Formik
        initialValues={initialValues}
        validationSchema={blockUserSchema}
        enableReinitialize
        onSubmit={async (values, helpers) => {
          try {
            await api.post(`/users/${userId}/block`, {
              reason: values.reason,
              customReason: values.reason === "other" ? values.customReason.trim() : "",
            })
            dispatch(removePostsByUser({ userId }))
            success(`${userName} is blocked`)
            onBlocked?.()
            onClose()
          } catch (err: unknown) {
            toastError(getErrorMessage(err, "Couldn’t block this person"))
            helpers.setSubmitting(false)
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setFieldValue }) => (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <DialogTitle id="block-user-dialog-title" sx={{ fontWeight: 700 }}>
              Block {userName}?
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", mb: 2 }}>
                You won’t see their posts, comments, or profile. They won’t see yours either. You’ll unfriend and
                unfollow each other. You can unblock them later from your profile.
              </Typography>
              <FormControl
                component="fieldset"
                error={Boolean(touched.reason && errors.reason)}
                disabled={isSubmitting}
                fullWidth
              >
                <FormLabel id="block-reason-label" sx={{ fontWeight: 700, mb: 0.75, color: "text.primary" }}>
                  Why are you blocking them?
                </FormLabel>
                <RadioGroup
                  aria-labelledby="block-reason-label"
                  name="reason"
                  value={values.reason}
                  onChange={event => {
                    void setFieldValue("reason", event.target.value)
                    if (event.target.value !== "other") {
                      void setFieldValue("customReason", "")
                    }
                  }}
                >
                  {BLOCK_REASON_OPTIONS.map(option => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio />}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
                {touched.reason && errors.reason ? <FormHelperText role="alert">{errors.reason}</FormHelperText> : null}
              </FormControl>
              {values.reason === "other" ? (
                <TextField
                  name="customReason"
                  label="Tell us a bit more"
                  value={values.customReason}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.customReason && errors.customReason)}
                  helperText={
                    touched.customReason && errors.customReason
                      ? errors.customReason
                      : `${values.customReason.length}/${CUSTOM_REASON_MAX}`
                  }
                  fullWidth
                  multiline
                  minRows={2}
                  slotProps={{ htmlInput: { maxLength: CUSTOM_REASON_MAX } }}
                  disabled={isSubmitting}
                  sx={{ mt: 1.5 }}
                />
              ) : null}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={onClose} disabled={isSubmitting} sx={{ textTransform: "none" }}>
                Cancel
              </Button>
              <Button
                type="submit"
                color="error"
                variant="contained"
                disabled={isSubmitting}
                autoFocus
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {isSubmitting ? "Blocking…" : "Block"}
              </Button>
            </DialogActions>
          </Box>
        )}
      </Formik>
    </Dialog>
  )
}

export default BlockUserDialog
