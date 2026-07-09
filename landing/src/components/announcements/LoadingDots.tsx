import { twMerge } from "tailwind-merge";

const Pip = (props: { className?: string }) => (
  <span
    className={twMerge(
      "inline-block size-[--loading-dots-size] rounded-full mx-0.5",
      "animate-[loading-dots_1.4s_ease-in-out_infinite_both]",
      "origin-center will-change-[opacity,_transform]",
      props.className,
    )}
  />
);

export const LoadingDots = (props: { className?: string }) => {
  return (
    <div
      className={twMerge(
        "items-center inline-flex [--loading-dots-size:5px]",
        props.className,
      )}
    >
      <Pip />
      <Pip className="[animation-delay:0.2s]" />
      <Pip className="[animation-delay:0.4s]" />
    </div>
  );
};
