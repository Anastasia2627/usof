import React from 'react';
import {
  IconHome, IconHomeFilled,
  IconLayoutGrid,
  IconCirclePlus,
  IconBookmark, IconBookmarkFilled,
  IconChartBar,
  IconSettings,
  IconShield, IconShieldLock,
  IconMessageCircle,
  IconHeart, IconHeartFilled,
  IconThumbDown, IconThumbDownFilled,
  IconUsers,
  IconLogout,
  IconUserCircle,
  IconDots,
  IconSearch,
  IconArrowRight, IconArrowLeft,
  IconChevronDown,
  IconX, IconCheck, IconPlus,
  IconRefresh, IconPencil, IconTrash, IconShare3,
  IconLock, IconLockOpen,
  IconAdjustmentsHorizontal,
  IconSun, IconMoon, IconLanguage,
  IconBell, IconPhoto, IconSend,
  IconEye, IconStar, IconStarFilled,
  IconMessages, IconActivity, IconCalendar,
  IconList, IconWorld, IconFolder,
} from '@tabler/icons-react';

// Single icon vocabulary for all of Circle. This replaces the historical
// Google SVG assets while preserving existing UI semantics and event handlers.
const icons = {
  home: IconHome,
  homeFilled: IconHomeFilled,
  categories: IconLayoutGrid,
  create: IconCirclePlus,
  plus: IconCirclePlus,
  plusSimple: IconPlus,
  bookmark: IconBookmarkFilled,
  bookmarkBorder: IconBookmark,
  dashboard: IconChartBar,
  analytics: IconChartBar,
  settings: IconSettings,
  shield: IconShield,
  admin: IconShieldLock,
  forum: IconMessages,
  chat: IconMessageCircle,
  comment: IconMessageCircle,
  heart: IconHeart,
  heartFilled: IconHeartFilled,
  favorite: IconHeartFilled,
  dislike: IconThumbDown,
  dislikeFilled: IconThumbDownFilled,
  group: IconUsers,
  logout: IconLogout,
  user: IconUserCircle,
  more: IconDots,
  search: IconSearch,
  arrow: IconArrowRight,
  arrowBack: IconArrowLeft,
  chevron: IconChevronDown,
  close: IconX,
  check: IconCheck,
  refresh: IconRefresh,
  edit: IconPencil,
  trash: IconTrash,
  share: IconShare3,
  lock: IconLock,
  unlock: IconLockOpen,
  sliders: IconAdjustmentsHorizontal,
  light: IconSun,
  dark: IconMoon,
  language: IconLanguage,
  bell: IconBell,
  photo: IconPhoto,
  send: IconSend,
  eye: IconEye,
  star: IconStar,
  starFilled: IconStarFilled,
  activity: IconActivity,
  calendar: IconCalendar,
  list: IconList,
  world: IconWorld,
  folder: IconFolder,
};

const activeVariants = {
  home: IconHomeFilled,
  heart: IconHeartFilled,
  dislike: IconThumbDownFilled,
  bookmarkBorder: IconBookmarkFilled,
  star: IconStarFilled,
};

export default function TablerIcon({ name, size=22, filled=false, stroke=1.8, className='' }) {
  const Component = (filled && activeVariants[name]) || icons[name] || IconCirclePlus;
  if (import.meta.env.DEV && !icons[name]) console.warn('Missing Tabler icon:', name);
  return <span className={['circleIcon','tablerSvgIcon','notranslate',className].filter(Boolean).join(' ')}
    translate="no" aria-hidden="true" style={{width:size,height:size}}>
    <Component size={size} stroke={stroke} aria-hidden="true" focusable="false"/>
  </span>;
}
