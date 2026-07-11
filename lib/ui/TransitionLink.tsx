"use client";
import { usePageTransition } from "./PageTransitionProvider";
import { ReactNode, CSSProperties, MouseEvent } from "react";

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function TransitionLink({ href, children, className, style }: Props) {
  const trigger = usePageTransition();
  // Href absolut (lintas subdomain) tidak bisa dilewati transisi client-side; biarkan
  // browser melakukan navigasi penuh.
  const isExternal = /^https?:\/\//i.test(href);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal) return;
    e.preventDefault();
    if (trigger) {
      trigger(href);
    } else {
      window.location.href = href;
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}
