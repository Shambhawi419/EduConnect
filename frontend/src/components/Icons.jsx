const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconHome(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function IconChat(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a7.5 7.5 0 0 1-7.5 7.5H6l-3 2.5V12A7.5 7.5 0 0 1 10.5 4.5H13A7.5 7.5 0 0 1 21 12Z" />
      <path d="M8.5 11h7M8.5 14.5h4.5" />
    </svg>
  );
}

export function IconQuiz(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14.5 3.5V8h4.5" />
      <path d="M8.5 12.5h7M8.5 15.5h5" />
    </svg>
  );
}

export function IconLock(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconAdmin(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16.5 7.5h4.5M16.5 11h4.5M16.5 14.5h3" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconDoc(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14.5 3.5V8h4.5" />
      <path d="M8.5 12h7M8.5 15h7M8.5 18h4" />
    </svg>
  );
}

export function IconBook(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2 2 0 0 0-2-2H4Z" />
      <path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-2h6Z" />
    </svg>
  );
}

export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function IconDots(props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

export function IconFilter(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

export function IconArrowUpRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 16 16 8" />
      <path d="M9.5 8H16v6.5" />
    </svg>
  );
}

export function IconBack(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </svg>
  );
}

export function IconShare(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="17.5" cy="6" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="18" r="2.6" />
      <path d="m8.9 10.7 6.2-3.4M8.9 13.3l6.2 3.4" />
    </svg>
  );
}

export function IconPlay(props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M9 6.8a.7.7 0 0 1 1.06-.6l7.2 4.6a.7.7 0 0 1 0 1.2l-7.2 4.6A.7.7 0 0 1 9 16V6.8Z" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg {...base} {...props}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </svg>
  );
}

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6V12l3 1.8" />
    </svg>
  );
}

export function IconGrid(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}

export function IconPencil(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 19.5h3l9.6-9.6a2.1 2.1 0 0 0-3-3L4.5 16.5v3Z" />
      <path d="m14.5 5.5 3 3" />
    </svg>
  );
}

export function IconTarget(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}

export function IconMark(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13.5l-4-2.5-4 2.5-4-2.5-4 2.5Z" />
    </svg>
  );
}
