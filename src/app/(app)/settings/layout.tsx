"use client";

// This layout file can be kept minimal if AppProvider is not needed.
// However, if any page under /settings needs context, it should be wrapped here.
// For now, we'll keep it simple as the pages are becoming self-sufficient.

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
