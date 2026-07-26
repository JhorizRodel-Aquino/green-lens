import { type ReactNode } from "react"

export default function UserLayout({children}: {children: ReactNode}) {
    return (
        <main className="relative h-dvh w-full overflow-hidden">
            {children}
        </main>
    )
}