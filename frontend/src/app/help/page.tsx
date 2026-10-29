"use client"

import { type ReactNode } from "react"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { Accordion, AccordionDetails, AccordionSummary, Box, Link as MuiLink, Typography } from "@mui/material"
import NextLink from "next/link"

import { useAppSelector } from "@/app/hooks"
import InfoPageShell from "@/components/InfoPageShell"

function faqs(isSignedIn: boolean): { q: string; a: ReactNode }[] {
  return [
    {
      q: "How do I create an account?",
      a: isSignedIn ? (
        <>
          You already have an account and are signed in. Open your{" "}
          <MuiLink component={NextLink} href="/profile">
            profile
          </MuiLink>{" "}
          to manage it, or go to{" "}
          <MuiLink component={NextLink} href="/home">
            Home
          </MuiLink>{" "}
          to use the feed. Sign out first if you need to create a different account.
        </>
      ) : (
        <>
          Open{" "}
          <MuiLink component={NextLink} href="/register">
            Create account
          </MuiLink>
          , enter your name, email, and password, then submit. You can also sign in with Google, GitHub, or Discord when
          those providers are configured.
        </>
      ),
    },
    {
      q: "I forgot my password - what can I do?",
      a: "Password reset by email is not available yet. If you signed up with Google, GitHub, or Discord, use that same provider to sign in again.",
    },
    {
      q: "How do I post photos?",
      a: "On Home, write something in “What’s on your mind?”, tap Image, add a JPEG/PNG/GIF/WebP (max 5MB), optionally insert emojis, then Post. You can also post text only.",
    },
    {
      q: "How do likes, comments, and saves work?",
      a: "Use the heart to like, the comment field under a post to reply, and the bookmark to save posts for later. On your profile, open the Saved, Liked, or Commented tabs to find them again.",
    },
    {
      q: "How do friends, follow, and Find people work?",
      a: "Open Find people from the sidebar (or /people) to search or browse recent users. Send a friend request - they must accept before you are mutual friends. Follow someone anytime to see their posts in the Following feed. The Everyone tab shows the wider public feed.",
    },
    {
      q: "How do I block or unblock someone?",
      a: (
        <>
          Open their profile, a post, or a comment and choose Block. Pick a reason (or write your own). You won’t see
          their posts, comments, or profile, and they won’t see yours. You also unfriend and unfollow each other. To
          undo it, open your{" "}
          <MuiLink component={NextLink} href="/profile">
            profile
          </MuiLink>{" "}
          and use the Blocked count.
        </>
      ),
    },
    {
      q: "How do I edit my profile?",
      a: "Click your name and photo at the bottom of the left sidebar to open your profile, then use the manage-account control on your profile card to update name, location, occupation, avatar, and social links.",
    },
    {
      q: "Is my data private?",
      a: (
        <>
          Xivi is a learning/demo social app. See our{" "}
          <MuiLink component={NextLink} href="/privacy">
            Privacy Policy
          </MuiLink>{" "}
          for what we store and how we use it. Do not post sensitive personal information you would not share publicly
          in a demo environment.
        </>
      ),
    },
    {
      q: "Where are the terms of use?",
      a: (
        <>
          Read the{" "}
          <MuiLink component={NextLink} href="/terms">
            Terms &amp; Conditions
          </MuiLink>{" "}
          for acceptable use, accounts, and content guidelines.
        </>
      ),
    },
  ]
}

const HelpPage = () => {
  const isSignedIn = Boolean(useAppSelector(state => state.accessToken))
  const items = faqs(isSignedIn)

  return (
    <InfoPageShell title="Help & FAQ" subtitle="Quick answers about Xivi accounts, posting, friends, and privacy.">
      <Typography
        sx={{
          color: "text.secondary",
          lineHeight: 1.65,
          mb: 2.5,
          maxWidth: 560,
        }}
      >
        Browse the questions below for common account and feed tips. Still stuck? Jump to Contact at the bottom of this
        page.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map(item => (
          <Accordion
            key={item.q}
            disableGutters
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: "12px !important",
              bgcolor: "background.alt",
              "&:before": { display: "none" },
              overflow: "hidden",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${item.q}-content`}
              id={`${item.q}-header`}
            >
              <Typography sx={{ fontWeight: 600 }}>{item.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ color: "text.secondary", lineHeight: 1.65 }}>{item.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Box
        id="contact"
        component="section"
        sx={{
          mt: 4,
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          boxShadow: theme =>
            theme.palette.mode === "dark" ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 3px rgba(28,25,23,0.06)",
          scrollMarginTop: "5rem",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Contact us
        </Typography>
        <Typography sx={{ color: "text.secondary", lineHeight: 1.65, mb: 2 }}>
          Questions about Xivi, account issues, or feedback on this demo? Reach out and we will get back when we can.
        </Typography>
        <Typography sx={{ lineHeight: 1.7 }}>
          Email:{" "}
          <MuiLink href="mailto:support@xivi.com" underline="hover" sx={{ fontWeight: 600 }}>
            support@xivi.com
          </MuiLink>
        </Typography>
        <Typography sx={{ color: "text.secondary", mt: 1.5, fontSize: "0.9rem", lineHeight: 1.6 }}>
          Please include your account email and a short description of the issue. For privacy or legal requests, see{" "}
          <MuiLink component={NextLink} href="/privacy">
            Privacy
          </MuiLink>{" "}
          and{" "}
          <MuiLink component={NextLink} href="/terms">
            Terms
          </MuiLink>
          .
        </Typography>
      </Box>
    </InfoPageShell>
  )
}

export default HelpPage
