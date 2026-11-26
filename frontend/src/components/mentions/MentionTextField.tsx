"use client"

import React, { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  Box,
  CircularProgress,
  ClickAwayListener,
  InputBase,
  type InputBaseProps,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
} from "@mui/material"

import UserImage from "@/components/UserImage"
import { api } from "@/lib/api"
import {
  getActiveMentionQuery,
  mentionDisplayOf,
  type MentionRef,
  MENTIONS_MAX,
  type MentionSuggestUser,
  pruneMentionedUserIds,
} from "@/lib/mentions"

export type MentionTextFieldProps = Omit<InputBaseProps, "onChange" | "value"> & {
  value: string
  onChange: (next: string) => void
  mentionedUserIds: string[]
  onMentionedUserIdsChange: (ids: string[]) => void
  /** Known display labels for pruning (e.g. when editing). */
  knownMentions?: MentionRef[]
  maxLength?: number
  truncate?: (value: string) => string
}

const MentionTextField = React.forwardRef<HTMLInputElement, MentionTextFieldProps>(
  function MentionTextField(
    {
      value,
      onChange,
      mentionedUserIds,
      onMentionedUserIdsChange,
      knownMentions = [],
      maxLength,
      truncate,
      onKeyDown,
      inputRef: inputRefProp,
      sx,
      ...inputProps
    },
    ref
  ) {
    const listId = useId()
    const anchorRef = useRef<HTMLElement | null>(null)
    const innerInputRef = useRef<HTMLInputElement | null>(null)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [mentionStart, setMentionStart] = useState<number | null>(null)
    const [options, setOptions] = useState<MentionSuggestUser[]>([])
    const [loading, setLoading] = useState(false)
    const [highlight, setHighlight] = useState(0)
    const displayByIdRef = useRef(new Map<string, string>())

    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        innerInputRef.current = node
        if (typeof inputRefProp === "function") inputRefProp(node)
        else if (inputRefProp && typeof inputRefProp === "object") {
          ;(inputRefProp as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      },
      [inputRefProp, ref]
    )

    const applyValue = useCallback(
      (next: string) => {
        const clipped = truncate ? truncate(next) : maxLength != null ? next.slice(0, maxLength) : next
        onChange(clipped)
        const pruned = pruneMentionedUserIds(clipped, mentionedUserIds, [
          ...knownMentions,
          ...[...displayByIdRef.current.entries()].map(([userId, display]) => ({ userId, display })),
        ])
        if (pruned.length !== mentionedUserIds.length || pruned.some((id, i) => id !== mentionedUserIds[i])) {
          onMentionedUserIdsChange(pruned)
        }
      },
      [knownMentions, maxLength, mentionedUserIds, onChange, onMentionedUserIdsChange, truncate]
    )

    const closePicker = useCallback(() => {
      setOpen(false)
      setOptions([])
      setMentionStart(null)
      setQuery("")
      setHighlight(0)
    }, [])

    useEffect(() => {
      if (!open || mentionStart == null) return
      let cancelled = false
      const handle = window.setTimeout(async () => {
        setLoading(true)
        try {
          const { data } = await api.get<{ users: MentionSuggestUser[] }>("/users/mention-suggest", {
            params: { q: query, limit: 8 },
          })
          if (cancelled) return
          setOptions(Array.isArray(data.users) ? data.users : [])
          setHighlight(0)
        } catch {
          if (!cancelled) setOptions([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      }, 220)
      return () => {
        cancelled = true
        window.clearTimeout(handle)
      }
    }, [open, query, mentionStart])

    const insertMention = useCallback(
      (user: MentionSuggestUser) => {
        if (mentionStart == null) return
        const display = mentionDisplayOf(user)
        if (!display) return
        const input = innerInputRef.current
        const cursor = input?.selectionStart ?? value.length
        const before = value.slice(0, mentionStart)
        const after = value.slice(cursor)
        const insertion = `@${display} `
        const next = `${before}${insertion}${after}`
        displayByIdRef.current.set(String(user._id), display)
        const nextIds = mentionedUserIds.includes(String(user._id))
          ? mentionedUserIds
          : [...mentionedUserIds, String(user._id)].slice(0, MENTIONS_MAX)
        onMentionedUserIdsChange(nextIds)
        applyValue(next)
        closePicker()
        requestAnimationFrame(() => {
          const el = innerInputRef.current
          if (!el) return
          const pos = before.length + insertion.length
          el.focus()
          el.setSelectionRange(pos, pos)
        })
      },
      [applyValue, closePicker, mentionStart, mentionedUserIds, onMentionedUserIdsChange, value]
    )

    const syncMentionState = (nextValue: string, cursor: number) => {
      const active = getActiveMentionQuery(nextValue, cursor)
      if (!active) {
        closePicker()
        return
      }
      setMentionStart(active.start)
      setQuery(active.query)
      setOpen(true)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value
      applyValue(next)
      const cursor = e.target.selectionStart ?? next.length
      syncMentionState(next, cursor)
    }

    const handleSelect = () => {
      const el = innerInputRef.current
      if (!el) return
      syncMentionState(value, el.selectionStart ?? value.length)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (open && options.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setHighlight(h => (h + 1) % options.length)
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setHighlight(h => (h - 1 + options.length) % options.length)
          return
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault()
          e.stopPropagation()
          const chosen = options[highlight]
          if (chosen) insertMention(chosen)
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          closePicker()
          return
        }
      }
      onKeyDown?.(e)
    }

    return (
      <ClickAwayListener onClickAway={closePicker}>
        <Box ref={anchorRef} sx={{ position: "relative", flex: 1, minWidth: 0, width: "100%" }}>
          <InputBase
            {...inputProps}
            fullWidth
            inputRef={setInputRef}
            value={value}
            onChange={handleChange}
            onSelect={handleSelect}
            onClick={handleSelect}
            onKeyDown={handleKeyDown}
            sx={[
              {
                width: "100%",
                "& .MuiInputBase-input": { width: "100%" },
              },
              ...(sx == null ? [] : Array.isArray(sx) ? sx : [sx]),
            ]}
            inputProps={{
              ...inputProps.inputProps,
              "aria-autocomplete": "list",
              "aria-controls": open ? listId : undefined,
              "aria-expanded": open,
              role: "combobox",
            }}
          />
          <Popper
            open={open}
            anchorEl={anchorRef.current}
            placement="bottom-start"
            style={{ zIndex: 1400, width: Math.max(anchorRef.current?.clientWidth || 0, 240) }}
          >
            <Paper
              elevation={6}
              sx={{
                mt: 0.5,
                maxHeight: 280,
                overflow: "auto",
                border: theme => `1px solid ${theme.palette.divider}`,
              }}
            >
              {loading && options.length === 0 ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
                  <CircularProgress size={22} />
                </Box>
              ) : options.length === 0 ? (
                <Typography sx={{ px: 1.5, py: 1.25, fontSize: "0.85rem", color: "text.secondary" }}>
                  {query ? "No people found" : "Type a name to mention"}
                </Typography>
              ) : (
                <List id={listId} dense disablePadding role="listbox" aria-label="Mention suggestions">
                  {options.map((user, index) => {
                    const name = mentionDisplayOf(user)
                    return (
                      <ListItemButton
                        key={user._id}
                        selected={index === highlight}
                        role="option"
                        aria-selected={index === highlight}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => insertMention(user)}
                      >
                        <ListItemAvatar sx={{ minWidth: 44 }}>
                          <UserImage
                            image={user.picturePath || ""}
                            name={name}
                            size="32px"
                            bgColor={user.avatarColor}
                          />
                        </ListItemAvatar>
                        <ListItemText
                          primary={name}
                          slotProps={{
                            primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } },
                          }}
                        />
                      </ListItemButton>
                    )
                  })}
                </List>
              )}
            </Paper>
          </Popper>
        </Box>
      </ClickAwayListener>
    )
  }
)

export default MentionTextField
