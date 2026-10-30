"use client"

import {
  AdminPanelSettingsOutlined,
  AlternateEmail,
  Block,
  CampaignOutlined,
  ChatBubbleOutlineOutlined,
  EventOutlined,
  ForumOutlined,
  GavelOutlined,
  GroupsOutlined,
  ImageOutlined,
  MailOutlined,
  NewspaperOutlined,
  ShieldOutlined,
  StorefrontOutlined,
  Tag,
  Upcoming,
  VisibilityOffOutlined,
} from "@mui/icons-material"
import { alpha, Box, Button, Divider, Link as MuiLink, Typography, useTheme } from "@mui/material"
import NextLink from "next/link"
import type { ReactNode } from "react"

import InfoPageShell from "@/components/InfoPageShell"

const CONTACT_EMAIL = "support@xivi.com"

type RoadmapItem = {
  title: string
  summary: string
  details?: string[]
  mockup?: ReactNode
  icon: ReactNode
}

function CommentThreadMockup() {
  const theme = useTheme()
  const isDark = theme.palette.mode === "dark"
  const bubble = isDark ? alpha(theme.palette.common.white, 0.06) : alpha(theme.palette.common.black, 0.04)
  const mention = theme.palette.primary.main

  const row = (opts: { name: string; initials: string; text: ReactNode; indent?: boolean }) => (
    <Box sx={{ display: "flex", gap: 1, pl: opts.indent ? 4.5 : 0, alignItems: "flex-start" }}>
      <Box
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          bgcolor: alpha(theme.palette.primary.main, 0.18),
          color: theme.palette.primary.main,
          fontSize: "0.65rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {opts.initials}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, py: 0.15 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.78rem", lineHeight: 1.3 }}>{opts.name}</Typography>
        <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.45 }}>{opts.text}</Typography>
      </Box>
    </Box>
  )

  return (
    <Box
      aria-hidden
      sx={{
        mt: 1.75,
        p: 1.75,
        borderRadius: "8px",
        bgcolor: bubble,
        border: `1px dashed ${theme.palette.divider}`,
      }}
    >
      <Typography
        sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", mb: 1.25 }}
      >
        PREVIEW · ONE-LEVEL REPLIES
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.15 }}>
        {row({
          name: "Ada Lovelace",
          initials: "AL",
          text: "This feed idea is going to be great.",
        })}
        {row({
          name: "Bob Friend",
          initials: "BF",
          indent: true,
          text: "Agree - especially if we can mention people.",
        })}
        {row({
          name: "Cara Lee",
          initials: "CL",
          indent: true,
          text: (
            <>
              Replying to Bob, same indent.{" "}
              <Box component="span" sx={{ color: mention, fontWeight: 600 }}>
                @ada
              </Box>{" "}
              what do you think?
            </>
          ),
        })}
      </Box>
    </Box>
  )
}

function HashtagCaptionMockup() {
  const theme = useTheme()
  const isDark = theme.palette.mode === "dark"
  const bubble = isDark ? alpha(theme.palette.common.white, 0.06) : alpha(theme.palette.common.black, 0.04)
  const tagColor = theme.palette.primary.main

  const tag = (label: string) => (
    <Box component="span" sx={{ color: tagColor, fontWeight: 600 }}>
      {label}
    </Box>
  )

  return (
    <Box
      aria-hidden
      sx={{
        mt: 1.75,
        p: 1.75,
        borderRadius: "8px",
        bgcolor: bubble,
        border: `1px dashed ${theme.palette.divider}`,
      }}
    >
      <Typography
        sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", mb: 1.25 }}
      >
        PREVIEW · TAGGED POST
      </Typography>
      <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.5 }}>
        Sunset from the ridge tonight. {tag("#travel")} {tag("#sunset")} Worth the climb.
      </Typography>
      <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 1, opacity: 0.85 }}>
        Tap a tag later to open every post that used it.
      </Typography>
    </Box>
  )
}

const ITEMS: RoadmapItem[] = [
  {
    title: "Private friend graphs",
    summary:
      "Hide your friends, followers, and following lists from other people. Counts may still show on your profile.",
    icon: <VisibilityOffOutlined />,
  },
  {
    title: "Dedicated admin host",
    summary: "A separate admin app or host, so site operations stay out of the everyday social UI.",
    icon: <AdminPanelSettingsOutlined />,
  },
  {
    title: "Moderator role",
    summary: "A role between regular member and full admin, for helping keep the community healthy.",
    icon: <GavelOutlined />,
  },
  {
    title: "Report",
    summary: "Report a person so moderators can review harassment, spam, or other problems.",
    icon: <Block />,
  },
  {
    title: "Comment replies and @mentions",
    summary:
      "Reply under a comment, and tag people with @. Mentions land in comments and replies only - not in new posts.",
    details: [
      "Type @ to open a small people picker that filters as you type.",
      "Choosing someone inserts @username as a link to their profile.",
      "Replies indent once. A reply to a reply stays in that same column - no Reddit-style nesting.",
    ],
    mockup: <CommentThreadMockup />,
    icon: <AlternateEmail />,
  },
  {
    title: "Hashtags on posts",
    summary:
      "Write #travel in a post and it becomes a link. Clicking it opens other posts that used the same tag.",
    details: [
      "Hashtags live in the post caption - not a separate tag picker in this pass.",
      "#Travel and #travel count as the same tag. Your original spelling stays in the text.",
      "Mentions (@name) are people; hashtags (#topic) are topics.",
    ],
    mockup: <HashtagCaptionMockup />,
    icon: <Tag />,
  },
  {
    title: "Richer posts",
    summary:
      "Several images on one post, smarter compression, and a soft-delete so a post can leave the feed without a hard wipe.",
    icon: <ImageOutlined />,
  },
  {
    title: "Richer messaging",
    summary:
      "1:1 text chat is live. Later: photos in a thread, edit or delete a send, a delivered tick, hide last seen, push alerts, and group threads.",
    details: [
      "Delivered tick: grey double tick when it reaches their device, before they open the chat. Today two ticks means they opened the thread.",
      "Images, GIFs, or files in a DM. Chat is text-only now.",
      "Edit or delete a message you already sent.",
      "Hide Online / last seen from people in a chat.",
      "A browser or phone alert if the tab is closed. Unread today is only the Messages badge in the app.",
      "Group chats: several people in one thread. That is not the Groups community tab.",
    ],
    icon: <ForumOutlined />,
  },
  {
    title: "Groups",
    summary: "Create or join communities with their own feed. Ongoing, unlike a one-off event.",
    details: ["A Groups tab is in the sidebar. Joining and posting in a group is not built yet."],
    icon: <GroupsOutlined />,
  },
  {
    title: "Events",
    summary: "Host or join hangouts with a date and time - meetups, birthdays, or anything scheduled.",
    details: ["An Events tab is in the sidebar. Creating and RSVPing is not built yet."],
    icon: <EventOutlined />,
  },
  {
    title: "Marketplace",
    summary: "Buy and sell with other people on Xivi. Member listings, not site-sold ads.",
    details: [
      "A Marketplace tab is in the sidebar. Listings are not built yet.",
      "Sponsored feed ads, if they come later, stay a separate product.",
    ],
    icon: <StorefrontOutlined />,
  },
  {
    title: "News",
    summary: "Headlines and stories in their own place, separate from posts by people you know.",
    details: ["A News tab is in the sidebar. Sources are not chosen yet."],
    icon: <NewspaperOutlined />,
  },
  {
    title: "Ads and sponsored content",
    summary: "Optional sponsored placements later. Not the same as Marketplace, and not a sidebar tab.",
    icon: <CampaignOutlined />,
  },
  {
    title: "More attachment types",
    summary: "GIF, audio, or other non-image attachments on posts, beyond the photos you can share now.",
    icon: <ChatBubbleOutlineOutlined />,
  },
]

const ComingSoonPage = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === "dark"
  const subtleDividerSx = {
    borderColor: alpha(theme.palette.common[isDark ? "white" : "black"], isDark ? 0.08 : 0.07),
    boxShadow: isDark
      ? `0 1px 0 ${alpha("#000", 0.35)}`
      : `0 1px 2px ${alpha(theme.palette.common.black, 0.035)}`,
  }

  return (
    <InfoPageShell
      title="Coming soon"
      subtitle="Ideas we plan to build in a later update - not in the app you are using today."
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          mb: 3,
          p: { xs: 2, sm: 2.25 },
          borderRadius: "12px",
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08),
          border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.16)}`,
        }}
      >
        <Upcoming sx={{ color: "primary.main", mt: 0.15, fontSize: "1.35rem" }} />
        <Typography sx={{ color: "text.secondary", lineHeight: 1.65, fontSize: "0.95rem" }}>
          These are planned directions, not a ship date. If you need one of them sooner, or you have an idea that is not
          listed, write to us - we read product mail.
        </Typography>
      </Box>

      <Box>
        {ITEMS.map((item, index) => (
          <Box key={item.title}>
            {index > 0 ? <Divider sx={subtleDividerSx} /> : null}
            <Box
              component="article"
              sx={{
                py: { xs: 2, sm: 2.25 },
              }}
            >
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                    color: "primary.main",
                  }}
                >
                  {item.icon}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {item.title}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "primary.main",
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                        px: 0.85,
                        py: 0.2,
                        borderRadius: 1,
                      }}
                    >
                      Later
                    </Typography>
                  </Box>
                  <Typography sx={{ color: "text.secondary", lineHeight: 1.6, fontSize: "0.9rem" }}>
                    {item.summary}
                  </Typography>
                  {item.details ? (
                    <Box component="ul" sx={{ m: 0, mt: 1.15, pl: 2.25, color: "text.secondary" }}>
                      {item.details.map(line => (
                        <Typography key={line} component="li" sx={{ fontSize: "0.85rem", lineHeight: 1.55, mb: 0.4 }}>
                          {line}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                  {item.mockup}
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mt: 0.5, ...subtleDividerSx }} />

      <Box
        id="ideas"
        component="section"
        sx={{
          py: { xs: 2.5, sm: 3 },
          scrollMarginTop: "5rem",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <ShieldOutlined sx={{ color: "primary.main", fontSize: "1.35rem" }} />
          <Typography variant="h5" sx={{ fontWeight: 650 }}>
            Need something sooner?
          </Typography>
        </Box>
        <Typography sx={{ color: "text.secondary", lineHeight: 1.65, mb: 2, maxWidth: 560 }}>
          If a planned feature is urgent for you, or you have a better idea that is not on this list, tell us. A short
          note with your account email is enough.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
          <Button
            component="a"
            href={`mailto:${CONTACT_EMAIL}?subject=Xivi%20feature%20idea`}
            variant="contained"
            startIcon={<MailOutlined />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, px: 2 }}
          >
            Email {CONTACT_EMAIL}
          </Button>
          <MuiLink
            component={NextLink}
            href="/help#contact"
            underline="hover"
            sx={{ fontWeight: 600, fontSize: "0.9rem" }}
          >
            Or open Help → Contact
          </MuiLink>
        </Box>
      </Box>
    </InfoPageShell>
  )
}

export default ComingSoonPage
