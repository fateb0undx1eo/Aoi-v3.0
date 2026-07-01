const iconBase = "inline size-[--font-size] align-text-bottom mr-1";

export function TextChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.99511C2.68915 17 2.4535 16.7257 2.4996 16.4227L2.70691 15.0394C2.7453 14.7831 2.96481 14.6 3.22383 14.6H6.40001L7.40001 9.4H4.39484C4.08888 9.4 3.85323 9.12573 3.89933 8.82266L4.10663 7.4394C4.14502 7.18307 4.36454 7 4.62356 7H7.80001L8.43422 3.58706C8.46437 3.41848 8.61127 3.3 8.78107 3.3H10.3634C10.6745 3.3 10.9101 3.58112 10.8557 3.88741L10.2511 7H13.4511L14.0853 3.58706C14.1155 3.41848 14.2624 3.3 14.4322 3.3H16.0145C16.3256 3.3 16.5612 3.58112 16.5068 3.88741L15.9022 7H19.007C19.313 7 19.5486 7.27427 19.5025 7.57734L19.2952 8.9606C19.2568 9.21693 19.0373 9.4 18.7783 9.4H15.5022L14.5022 14.6H17.6073C17.9133 14.6 18.1489 14.8743 18.1028 15.1773L17.8955 16.5606C17.8571 16.8169 17.6376 17 17.3786 17H14.1022L13.4676 20.413C13.4375 20.5815 13.2906 20.7 13.1208 20.7H11.5385C11.2274 20.7 10.9918 20.4189 11.0462 20.1126L11.648 17H8.44799L7.81347 20.413C7.78332 20.5815 7.63642 20.7 7.46662 20.7H5.88657Z" />
    </svg>
  );
}

export function VoiceChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 3C10.9 3 10 3.9 10 5V9C10 10.1 10.9 11 12 11C13.1 11 14 10.1 14 9V5C14 3.9 13.1 3 12 3Z" />
      <path d="M7 9C7 11.76 9.24 14 12 14C14.76 14 17 11.76 17 9H15C15 10.66 13.66 12 12 12C10.34 12 9 10.66 9 9H7Z" />
      <path d="M19 9C19 12.87 15.87 16 12 16C8.13 16 5 12.87 5 9H3C3 13.67 6.79 17.52 11.5 17.94V21H12.5V17.94C17.21 17.52 21 13.67 21 9H19Z" />
    </svg>
  );
}

export function ThreadChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16 13H13V16C13 16.55 12.55 17 12 17C11.45 17 11 16.55 11 16V13H8C7.45 13 7 12.55 7 12C7 11.45 7.45 11 8 11H11V8C11 7.45 11.45 7 12 7C12.55 7 13 7.45 13 8V11H16C16.55 11 17 11.45 17 12C17 12.55 16.55 13 16 13Z" />
    </svg>
  );
}

export function ForumChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" />
      <path d="M7 9H17V11H7Z" />
      <path d="M7 6H17V8H7Z" />
      <path d="M7 12H14V14H7Z" />
    </svg>
  );
}

export function MediaChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" />
    </svg>
  );
}

export function GuideChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2L2 7L12 12L22 7L12 2Z" />
      <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" />
    </svg>
  );
}

export function BrowseChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M10 4H4C2.9 4 2 4.9 2 6V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V14H20V20H4V6H10V4Z" />
      <path d="M22 2H14V4H18.6L11 11.6L12.4 13L20 5.4V10H22V2Z" />
    </svg>
  );
}

export function LinkedRolesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3.9 12C3.9 10.29 5.29 8.9 7 8.9H11V7H7C4.24 7 2 9.24 2 12C2 14.76 4.24 17 7 17H11V15.1H7C5.29 15.1 3.9 13.71 3.9 12Z" />
      <path d="M8 13H16V11H8V13Z" />
      <path d="M17 7H13V8.9H17C18.71 8.9 20.1 10.29 20.1 12C20.1 13.71 18.71 15.1 17 15.1H13V17H17C19.76 17 22 14.76 22 12C22 9.24 19.76 7 17 7Z" />
    </svg>
  );
}

export function PostChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconBase} ${className ?? ""}`}
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" />
    </svg>
  );
}
