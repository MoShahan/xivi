export type UserRelationship = {
  isSelf?: boolean
  isFriend: boolean
  isFollowing: boolean
  outgoingRequestId: string | null
  incomingRequestId: string | null
  blockedByMe?: boolean
}

export type FriendRequestUser = {
  _id: string
  firstName?: string
  lastName?: string
  picturePath?: string
  avatarColor?: string
}

export type FriendRequestItem = {
  _id: string
  from: string
  to: string
  status: string
  createdAt?: string
  user: FriendRequestUser | null
}
