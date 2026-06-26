export default function MessageDivider({ children }: React.PropsWithChildren) {
  return (
    <div className="relative my-6 flex h-0 items-center border-t border-zinc-600 opacity-50">
      <span className="-mt-px mx-auto rounded-lg bg-white px-1 py-[2px] text-xs font-semibold leading-[13px] text-zinc-500 dark:bg-[#2b2d31] dark:text-zinc-400">
        {children}
      </span>
    </div>
  );
}
