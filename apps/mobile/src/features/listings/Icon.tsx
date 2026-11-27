import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Line icons from the provider design prototype (a few extras drawn in the same style).
const icons = {
  bag: <><Path d="M5 8h14l-1 12H6Z" /><Path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  lock: <><Rect x="5" y="11" width="14" height="10" rx="2" /><Path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  trash: <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  info: <><Circle cx="12" cy="12" r="9" /><Path d="M12 11v5M12 8h.01" /></>,
  settings: <><Circle cx="12" cy="12" r="3" /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  grid: <><Rect x="3" y="3" width="7" height="7" rx="2" /><Rect x="14" y="3" width="7" height="7" rx="2" /><Rect x="3" y="14" width="7" height="7" rx="2" /><Rect x="14" y="14" width="7" height="7" rx="2" /></>,
  box: <><Path d="m4 7 8-4 8 4-8 4Z" /><Path d="m4 7 8 4 8-4v10l-8 4-8-4Z" /><Path d="M12 11v10" /></>,
  receipt: <><Path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><Path d="M9 8h6M9 12h6M9 16h3" /></>,
  chart: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></>,
  bell: <><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><Path d="M10 21h4" /></>,
  leaf: <><Path d="M20 4C10 4 5 9 5 16c4 0 11-1 15-12Z" /><Path d="M4 20c3-6 7-8 12-11" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  clock: <><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></>,
  check: <Path d="m5 12 4 4L19 6" />,
  pin: <><Path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><Circle cx="12" cy="10" r="2.5" /></>,
  chevron: <Path d="m9 18 6-6-6-6" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  edit: <><Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  eye: <><Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><Circle cx="12" cy="12" r="2.5" /></>,
  back: <Path d="m15 18-6-6 6-6" />,
  camera: <><Path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11h18V7a2 2 0 0 0-2-2Z" /><Circle cx="12" cy="12" r="4" /></>,
  upload: <Path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" />,
  wallet: <><Path d="M3 6h16v14H3Z" /><Path d="M3 9h16M15 14h6v4h-6Z" /></>,
  food: <Path d="M6 3v8M3 3v5a3 3 0 0 0 6 0V3M6 11v10M16 3v18M16 3c4 2 5 7 0 10" />,
  sparkles: <Path d="m12 3-1 3.5L7.5 8 11 9.5l1 3.5 1-3.5L16.5 8 13 6.5ZM5 14l-.7 2.3L2 17l2.3.7L5 20l.7-2.3L8 17l-2.3-.7Z" />,
  shield: <><Path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><Path d="m9 12 2 2 4-4" /></>,
  phone: <Path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z" />,
  mail: <><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="m3 7 9 6 9-6" /></>,
  help: <><Circle cx="12" cy="12" r="9" /><Path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.5 1-1.5 2.2M12 17h.01" /></>,
  logout: <Path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />,
  calendar: <><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M16 3v4M8 3v4M3 10h18" /></>,
  arrow: <Path d="M5 12h14M14 7l5 5-5 5" />,
  store: <><Path d="M4 10v11h16V10M3 4h18l-1 6a3 3 0 0 1-4 1 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-4-1Z" /><Path d="M9 21v-6h6v6" /></>,
  alert: <><Path d="M12 3 2 21h20Z" /><Path d="M12 9v5M12 18h.01" /></>,
  close: <Path d="m6 6 12 12M18 6 6 18" />,
  users: <><Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  trend: <><Path d="m3 17 6-6 4 4 8-9" /><Path d="M15 6h6v6" /></>,
  search: <><Circle cx="11" cy="11" r="7" /><Path d="m20 20-4-4" /></>,
  filter: <Path d="M4 6h16M7 12h10M10 18h4" />,
  image: <><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="8.5" cy="9.5" r="1.5" /><Path d="m21 16-5-5L5 20" /></>,
  refresh: <><Path d="M20 11a8 8 0 0 0-14-4L4 9" /><Path d="M4 4v5h5" /><Path d="M4 13a8 8 0 0 0 14 4l2-2" /><Path d="M20 20v-5h-5" /></>,
  moon: <Path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 22, color = "#2B2118", strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </Svg>
  );
}
