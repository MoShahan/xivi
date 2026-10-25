"use client"

import { type ReactNode, useCallback, useEffect, useState } from "react"
import {
  Close,
  DarkMode,
  EventOutlined,
  GroupsOutlined,
  Help,
  HomeOutlined,
  LightMode,
  LogoutOutlined,
  MailOutlined,
  Menu as MenuIcon,
  NewspaperOutlined,
  PersonAddAlt1,
  PersonSearchOutlined,
  SettingsOutlined,
  StorefrontOutlined,
  TourOutlined,
  Upcoming,
} from "@mui/icons-material"
import {
  alpha,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { usePathname, useRouter } from "next/navigation"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { api } from "@/lib/api"
import { TOUR_OPEN_FIND_PEOPLE_NAV_EVENT, TOUR_OPEN_MENU_EVENT } from "@/lib/productTour"
import { useFeatureFlags } from "@/providers/FeatureFlagsProvider"
import { useProductTour } from "@/providers/ProductTourProvider"
import { useToast } from "@/providers/ToastProvider"
import { setLogout, toggleMode } from "@/state"
import { store } from "@/state/store"
import { sameUserId } from "@/types/models"

import BrandLogo from "./BrandLogo"
import FlexBetween from "./FlexBetween"
import NotificationsMenu from "./NotificationsMenu"
import PageShell from "./PageShell"
import { navListItemSelectedSx, navListItemSx } from "./sharedSx"
import UserImage from "./UserImage"

export const APP_SHELL_SIDEBAR_WIDTH = 256
export const APP_SHELL_TOPBAR_HEIGHT = 56

type AppShellProps = {
  children: ReactNode
  /** Constrain main content width (post, notifications, people, etc.). */
  narrow?: boolean
}

type NavItem = {
  id: string
  label: string
  href: string
  icon: ReactNode
  tour?: string
  badge?: number
  match: (pathname: string) => boolean
}

const AppShell = ({ children, narrow = false }: AppShellProps) => {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname() || ""
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const { success } = useToast()
  const { startTour } = useProductTour()
  const { enabled } = useFeatureFlags()
  const showNotifications = enabled("notifications")
  const isWide = useMediaQuery("(min-width: 1000px)")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [friendRequestCount, setFriendRequestCount] = useState(0)

  const dark = theme.palette.neutral.dark
  const medium = theme.palette.neutral.medium
  const alt = theme.palette.background.alt
  const isDark = theme.palette.mode === "dark"
  const fullName = user ? `${user.firstName} ${user.lastName}` : "Profile"
  const notificationsActive = pathname === "/notifications" || pathname.startsWith("/notifications/")

  const closeMobile = () => setMobileOpen(false)

  const refreshFriendRequestCount = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>("/users/me/friend-requests/count")
      setFriendRequestCount(data.count || 0)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const boot = window.setTimeout(() => void refreshFriendRequestCount(), 0)
    const id = window.setInterval(() => void refreshFriendRequestCount(), 60_000)
    return () => {
      window.clearTimeout(boot)
      window.clearInterval(id)
    }
  }, [refreshFriendRequestCount])

  useEffect(() => {
    const openMenu = () => {
      if (!isWide) setMobileOpen(true)
    }
    window.addEventListener(TOUR_OPEN_MENU_EVENT, openMenu)
    return () => window.removeEventListener(TOUR_OPEN_MENU_EVENT, openMenu)
  }, [isWide])

  useEffect(() => {
    const openFindPeopleNav = () => {
      if (!isWide) setMobileOpen(true)
    }
    window.addEventListener(TOUR_OPEN_FIND_PEOPLE_NAV_EVENT, openFindPeopleNav)
    return () => window.removeEventListener(TOUR_OPEN_FIND_PEOPLE_NAV_EVENT, openFindPeopleNav)
  }, [isWide])

  const handleLogout = () => {
    closeMobile()
    const refreshToken = store.getState().refreshToken
    void (async () => {
      try {
        if (refreshToken) {
          await api.post("/auth/logout", { refreshToken })
        } else {
          await api.post("/auth/logout", {})
        }
      } catch {
        // Client logout still proceeds if revoke fails (expired session, offline).
      } finally {
        dispatch(setLogout())
        success("Signed out")
        router.push("/login")
      }
    })()
  }

  const handleShowTutorial = () => {
    closeMobile()
    startTour()
  }

  const navigate = (href: string) => {
    closeMobile()
    router.push(href)
  }

  const primaryItems: NavItem[] = [
    {
      id: "home",
      label: "Home",
      href: "/home",
      icon: <HomeOutlined />,
      tour: "nav-home",
      match: p => p === "/home",
    },
    {
      id: "messages",
      label: "Messages",
      href: "/messages",
      icon: <MailOutlined />,
      match: p => p === "/messages" || p.startsWith("/messages/"),
    },
    {
      id: "people",
      label: "Find people",
      href: "/people",
      icon: <PersonSearchOutlined />,
      tour: "nav-find-people",
      match: p => p === "/people" || p.startsWith("/people/"),
    },
    {
      id: "friend-requests",
      label: "Friend requests",
      href: "/friend-requests",
      icon: <PersonAddAlt1 />,
      badge: friendRequestCount,
      match: p => p === "/friend-requests" || p.startsWith("/friend-requests/"),
    },
    {
      id: "groups",
      label: "Groups",
      href: "/groups",
      icon: <GroupsOutlined />,
      match: p => p === "/groups" || p.startsWith("/groups/"),
    },
    {
      id: "events",
      label: "Events",
      href: "/events",
      icon: <EventOutlined />,
      match: p => p === "/events" || p.startsWith("/events/"),
    },
    {
      id: "marketplace",
      label: "Marketplace",
      href: "/marketplace",
      icon: <StorefrontOutlined />,
      match: p => p === "/marketplace" || p.startsWith("/marketplace/"),
    },
    {
      id: "news",
      label: "News",
      href: "/news",
      icon: <NewspaperOutlined />,
      match: p => p === "/news" || p.startsWith("/news/"),
    },
  ]

  const profileActive =
    pathname === "/profile" ||
    Boolean(user?._id && (() => {
      const m = /^\/profile\/([^/]+)/.exec(pathname)
      return m && sameUserId(m[1], user._id)
    })())

  const renderNavList = () => (
    <List sx={{ px: 1, py: 0.5, flex: 1 }}>
      {primaryItems.map(item => {
        const selected = item.match(pathname)
        return (
          <ListItemButton
            key={item.id}
            data-tour={item.tour}
            selected={selected}
            onClick={() => navigate(item.href)}
            sx={navListItemSelectedSx(isDark)}
          >
            <ListItemIcon sx={{ minWidth: 40, color: selected ? "primary.main" : undefined }}>
              {item.badge ? (
                <Badge
                  color="error"
                  badgeContent={item.badge}
                  max={9}
                  overlap="circular"
                  sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem" } }}
                >
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{
                primary: { sx: { fontWeight: selected ? 700 : 500, fontSize: "0.925rem" } },
              }}
            />
          </ListItemButton>
        )
      })}
    </List>
  )

  const renderSecondaryActions = () => (
    <List sx={{ px: 1, py: 0.5 }}>
      <ListItemButton
        data-tour="nav-settings"
        selected={pathname === "/settings" || pathname.startsWith("/settings/")}
        onClick={() => navigate("/settings")}
        sx={navListItemSx}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <SettingsOutlined />
        </ListItemIcon>
        <ListItemText primary="Settings" />
      </ListItemButton>
      <ListItemButton
        selected={pathname === "/coming-soon" || pathname.startsWith("/coming-soon/")}
        onClick={() => navigate("/coming-soon")}
        sx={navListItemSx}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Upcoming />
        </ListItemIcon>
        <ListItemText primary="Coming soon" />
      </ListItemButton>
      <ListItemButton onClick={() => navigate("/help")} sx={navListItemSx}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Help />
        </ListItemIcon>
        <ListItemText primary="Help & FAQ" />
      </ListItemButton>
      <ListItemButton onClick={handleShowTutorial} sx={navListItemSx}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <TourOutlined />
        </ListItemIcon>
        <ListItemText primary="Show tutorial" />
      </ListItemButton>
      <ListItemButton
        onClick={() => dispatch(toggleMode())}
        sx={navListItemSx}
        aria-label="Toggle theme"
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {isDark ? <LightMode /> : <DarkMode />}
        </ListItemIcon>
        <ListItemText primary={isDark ? "Light mode" : "Dark mode"} />
      </ListItemButton>
    </List>
  )

  const renderAccountBlock = () => (
    <Box sx={{ px: 1.5, py: 1.5 }}>
      <ListItemButton
        data-tour="nav-profile"
        selected={profileActive}
        onClick={() => navigate("/profile")}
        aria-label={`Open your profile (${fullName})`}
        aria-current={profileActive ? "page" : undefined}
        sx={{ ...navListItemSelectedSx(isDark), px: 1, py: 0.85, mb: 1, gap: 1.25 }}
      >
        <UserImage
          image={user?.picturePath || ""}
          name={fullName}
          size="40px"
          bgColor={user?.avatarColor}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            noWrap
            title={fullName}
            sx={{
              fontWeight: profileActive ? 700 : 600,
              color: profileActive ? "primary.main" : dark,
              fontSize: "0.9rem",
            }}
          >
            {fullName}
          </Typography>
          <Typography variant="body2" sx={{ color: medium, fontSize: "0.75rem" }}>
            View profile
          </Typography>
        </Box>
      </ListItemButton>
      <Button
        fullWidth
        onClick={handleLogout}
        startIcon={<LogoutOutlined />}
        sx={{
          color: theme.palette.error.main,
          textTransform: "none",
          justifyContent: "flex-start",
          px: 1.25,
        }}
      >
        Log out
      </Button>
    </Box>
  )

  const renderSideNavBody = (opts?: { showBrand?: boolean }) => (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {opts?.showBrand !== false ? (
        <Box
          sx={{
            height: APP_SHELL_TOPBAR_HEIGHT,
            flexShrink: 0,
            px: 2,
            display: "flex",
            alignItems: "center",
            // Same height + bottom edge as the main column top bar so borders meet.
            borderBottom: `1px solid ${theme.palette.divider}`,
            boxSizing: "border-box",
          }}
        >
          <BrandLogo size="nav" onClick={() => navigate("/home")} />
        </Box>
      ) : null}
      {renderNavList()}
      <Box sx={{ mt: "auto" }}>
        <Divider />
        {renderSecondaryActions()}
        <Divider />
        {renderAccountBlock()}
      </Box>
    </Box>
  )

  const topBar = (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        height: APP_SHELL_TOPBAR_HEIGHT,
        flexShrink: 0,
        boxSizing: "border-box",
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(alt, isDark ? 0.72 : 0.78),
        backdropFilter: "saturate(1.2) blur(14px)",
        WebkitBackdropFilter: "saturate(1.2) blur(14px)",
        display: "flex",
        alignItems: "center",
        px: { xs: 1, sm: 1.5 },
      }}
    >
      <FlexBetween sx={{ width: "100%", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          {!isWide ? (
            <>
              <IconButton
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                aria-controls="app-shell-drawer"
              >
                <MenuIcon />
              </IconButton>
              <BrandLogo size="nav" onClick={() => navigate("/home")} />
            </>
          ) : (
            <Box aria-hidden sx={{ width: 8 }} />
          )}
        </Box>
        {showNotifications ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              borderRadius: 2,
              ...(notificationsActive
                ? {
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
                  }
                : null),
            }}
          >
            <NotificationsMenu />
          </Box>
        ) : (
          <Box aria-hidden sx={{ width: 8 }} />
        )}
      </FlexBetween>
    </Box>
  )

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100dvh",
        bgcolor: "background.default",
      }}
    >
      {isWide ? (
        <Box
          component="nav"
          aria-label="Main"
          sx={{
            width: APP_SHELL_SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: `1px solid ${theme.palette.divider}`,
            bgcolor: alt,
            position: "sticky",
            top: 0,
            alignSelf: "flex-start",
            height: "100dvh",
            overflowY: "auto",
          }}
        >
          {renderSideNavBody()}
        </Box>
      ) : null}

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {topBar}
        <PageShell narrow={narrow}>{children}</PageShell>
      </Box>

      <Drawer
        id="app-shell-drawer"
        anchor="left"
        open={!isWide && mobileOpen}
        onClose={closeMobile}
        slotProps={{
          paper: {
            sx: {
              width: "min(300px, 88vw)",
              bgcolor: alt,
              borderRight: `1px solid ${theme.palette.divider}`,
              backgroundImage: "none",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <FlexBetween sx={{ px: 2, py: 1.25 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: dark }}>
              Menu
            </Typography>
            <IconButton onClick={closeMobile} aria-label="Close menu">
              <Close />
            </IconButton>
          </FlexBetween>
          <Divider />
          {renderSideNavBody({ showBrand: false })}
        </Box>
      </Drawer>
    </Box>
  )
}

export default AppShell
